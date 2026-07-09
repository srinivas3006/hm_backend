const paymentRepository = require('../repositories/paymentRepository');
const paymentLedgerRepository = require('../repositories/paymentLedgerRepository');
const logger = require('../utils/logger');
const upiQRCodeService = require('../payments/qr/upiQRCodeService');
const eventBus = require('../events/eventBus');
const { DOMAIN_EVENTS } = require('../events/eventCatalog');

const {
  PaymentRepositoryError,
  PaymentNotFoundError,
  DuplicatePaymentReferenceError,
  DuplicateSuccessfulPaymentError,
  DuplicateActivePaymentIntentError,
  InvalidPaymentIdError
} = require('../repositories/paymentRepository');

const {
  PaymentLedgerRepositoryError
} = require('../repositories/paymentLedgerRepository');

const PAYMENT_STATUS = {
  INTENT_CREATED: 'INTENT_CREATED',
  QR_PENDING: 'QR_PENDING',
  QR_GENERATED: 'QR_GENERATED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',
  VERIFICATION_PENDING: 'VERIFICATION_PENDING',
  PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_EXPIRED: 'PAYMENT_EXPIRED',
  PAYMENT_CANCELLED: 'PAYMENT_CANCELLED',
  REFUND_REQUESTED: 'REFUND_REQUESTED',
  REFUND_APPROVED: 'REFUND_APPROVED',
  REFUNDED: 'REFUNDED'
};

const LEGACY_STATUS_ALIASES = {
  PENDING: PAYMENT_STATUS.PAYMENT_PENDING,
  SUBMITTED: PAYMENT_STATUS.PAYMENT_SUBMITTED,
  VERIFIED: PAYMENT_STATUS.PAYMENT_VERIFIED,
  FAILED: PAYMENT_STATUS.PAYMENT_FAILED,
  EXPIRED: PAYMENT_STATUS.PAYMENT_EXPIRED,
  CANCELLED: PAYMENT_STATUS.PAYMENT_CANCELLED
};

const SUCCESS_STATUSES = new Set([
  PAYMENT_STATUS.PAYMENT_VERIFIED,
  PAYMENT_STATUS.REFUND_REQUESTED,
  PAYMENT_STATUS.REFUND_APPROVED,
  PAYMENT_STATUS.REFUNDED
]);

const TERMINAL_STATUSES = new Set([
  PAYMENT_STATUS.PAYMENT_VERIFIED,
  PAYMENT_STATUS.PAYMENT_REJECTED,
  PAYMENT_STATUS.PAYMENT_FAILED,
  PAYMENT_STATUS.PAYMENT_EXPIRED,
  PAYMENT_STATUS.PAYMENT_CANCELLED,
  PAYMENT_STATUS.REFUNDED
]);

const ALLOWED_TRANSITIONS = {
  [PAYMENT_STATUS.INTENT_CREATED]: [
    PAYMENT_STATUS.QR_PENDING,
    PAYMENT_STATUS.QR_GENERATED,
    PAYMENT_STATUS.PAYMENT_PENDING,
    PAYMENT_STATUS.PAYMENT_SUBMITTED,
    PAYMENT_STATUS.PAYMENT_EXPIRED,
    PAYMENT_STATUS.PAYMENT_CANCELLED
  ],
  [PAYMENT_STATUS.QR_PENDING]: [
    PAYMENT_STATUS.QR_GENERATED,
    PAYMENT_STATUS.PAYMENT_PENDING,
    PAYMENT_STATUS.PAYMENT_EXPIRED,
    PAYMENT_STATUS.PAYMENT_CANCELLED
  ],
  [PAYMENT_STATUS.QR_GENERATED]: [
    PAYMENT_STATUS.QR_GENERATED,
    PAYMENT_STATUS.PAYMENT_PENDING,
    PAYMENT_STATUS.PAYMENT_SUBMITTED,
    PAYMENT_STATUS.PAYMENT_EXPIRED,
    PAYMENT_STATUS.PAYMENT_CANCELLED
  ],
  [PAYMENT_STATUS.PAYMENT_PENDING]: [
    PAYMENT_STATUS.PAYMENT_SUBMITTED,
    PAYMENT_STATUS.PAYMENT_FAILED,
    PAYMENT_STATUS.PAYMENT_EXPIRED,
    PAYMENT_STATUS.PAYMENT_CANCELLED
  ],
  [PAYMENT_STATUS.PAYMENT_SUBMITTED]: [
    PAYMENT_STATUS.VERIFICATION_PENDING,
    PAYMENT_STATUS.PAYMENT_VERIFIED,
    PAYMENT_STATUS.PAYMENT_REJECTED,
    PAYMENT_STATUS.PAYMENT_FAILED
  ],
  [PAYMENT_STATUS.VERIFICATION_PENDING]: [
    PAYMENT_STATUS.PAYMENT_VERIFIED,
    PAYMENT_STATUS.PAYMENT_REJECTED,
    PAYMENT_STATUS.PAYMENT_FAILED
  ],
  [PAYMENT_STATUS.PAYMENT_VERIFIED]: [
    PAYMENT_STATUS.REFUND_REQUESTED
  ],
  [PAYMENT_STATUS.REFUND_REQUESTED]: [
    PAYMENT_STATUS.REFUND_APPROVED,
    PAYMENT_STATUS.PAYMENT_FAILED
  ],
  [PAYMENT_STATUS.REFUND_APPROVED]: [
    PAYMENT_STATUS.REFUNDED,
    PAYMENT_STATUS.PAYMENT_FAILED
  ],
  [PAYMENT_STATUS.PAYMENT_FAILED]: [],
  [PAYMENT_STATUS.PAYMENT_REJECTED]: [],
  [PAYMENT_STATUS.PAYMENT_EXPIRED]: [],
  [PAYMENT_STATUS.PAYMENT_CANCELLED]: [],
  [PAYMENT_STATUS.REFUNDED]: []
};

const DEFAULT_INTENT_EXPIRY_MINUTES = 15;

class PaymentServiceError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

class PaymentAlreadyCompletedError extends PaymentServiceError {
  constructor(details = {}) {
    super('Payment is already completed', 'PAYMENT_ALREADY_COMPLETED', details);
  }
}

class InvalidPaymentTransitionError extends PaymentServiceError {
  constructor(fromStatus, toStatus) {
    super('Invalid payment status transition', 'INVALID_PAYMENT_TRANSITION', { fromStatus, toStatus });
  }
}

class PaymentOwnershipError extends PaymentServiceError {
  constructor(details = {}) {
    super('Payment does not belong to the expected owner', 'PAYMENT_OWNERSHIP_ERROR', details);
  }
}

class PaymentExpiredError extends PaymentServiceError {
  constructor(details = {}) {
    super('Payment has expired', 'PAYMENT_EXPIRED', details);
  }
}

class PaymentAlreadyVerifiedError extends PaymentServiceError {
  constructor(details = {}) {
    super('Payment has already been verified', 'PAYMENT_ALREADY_VERIFIED', details);
  }
}

class PaymentVerificationRejectedError extends PaymentServiceError {
  constructor(details = {}) {
    super('Payment verification was rejected', 'PAYMENT_VERIFICATION_REJECTED', details);
  }
}

class DuplicateUTRError extends PaymentServiceError {
  constructor(details = {}) {
    super('UTR is already linked to another payment', 'DUPLICATE_UTR', details);
  }
}

class InvalidUTRError extends PaymentServiceError {
  constructor(details = {}) {
    super('UTR format is invalid', 'INVALID_UTR', details);
  }
}

class PaymentUTRAlreadySubmittedError extends PaymentServiceError {
  constructor(details = {}) {
    super('Payment attempt already has a submitted UTR', 'PAYMENT_UTR_ALREADY_SUBMITTED', details);
  }
}

class PaymentVerificationAuthorizationError extends PaymentServiceError {
  constructor(details = {}) {
    super('Payment verification requires an authorized actor', 'PAYMENT_VERIFICATION_AUTHORIZATION_ERROR', details);
  }
}

class PaymentCreationNotAllowedError extends PaymentServiceError {
  constructor(details = {}) {
    super('Payment attempt cannot be created', 'PAYMENT_CREATION_NOT_ALLOWED', details);
  }
}

class PaymentIntentAmountMismatchError extends PaymentServiceError {
  constructor(details = {}) {
    super('Payment intent amount does not match order amount', 'PAYMENT_INTENT_AMOUNT_MISMATCH', details);
  }
}

class PaymentIntentInactiveError extends PaymentServiceError {
  constructor(details = {}) {
    super('Payment intent is not active', 'PAYMENT_INTENT_INACTIVE', details);
  }
}

class PaymentQRCodeGenerationError extends PaymentServiceError {
  constructor(message = 'Payment QR generation failed', details = {}) {
    super(message, 'PAYMENT_QR_GENERATION_ERROR', details);
  }
}

class PaymentQRCodeUnavailableError extends PaymentServiceError {
  constructor(details = {}) {
    super('Payment QR code is unavailable', 'PAYMENT_QR_UNAVAILABLE', details);
  }
}

class PaymentDataAccessError extends PaymentServiceError {
  constructor(message = 'Payment data access failed', details = {}) {
    super(message, 'PAYMENT_DATA_ACCESS_ERROR', details);
  }
}

const normalizeId = (value) => (value && value.toString ? value.toString() : String(value));

const toCanonicalStatus = (status) => LEGACY_STATUS_ALIASES[status] || status;

const maskReference = (value) => {
  if (!value) return undefined;
  const normalized = String(value);
  if (normalized.length <= 4) return '****';
  return `${'*'.repeat(Math.max(normalized.length - 4, 4))}${normalized.slice(-4)}`;
};

const isExpired = (payment, now = new Date()) => payment.expiresAt && new Date(payment.expiresAt) <= now;

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60 * 1000);

class PaymentService {
  constructor(
    repository = paymentRepository,
    serviceLogger = logger,
    qrService = upiQRCodeService,
    ledgerRepository = paymentLedgerRepository
  ) {
    this.repository = repository;
    this.logger = serviceLogger;
    this.qrService = qrService;
    this.ledgerRepository = ledgerRepository;
  }

  async createPayment(paymentData, options = {}) {
    return this.execute('createPayment', async () => {
      await this.assertCanCreatePaymentAttempt(paymentData.order, options);

      const payment = await this.repository.create({
        ...paymentData,
        status: paymentData.status || PAYMENT_STATUS.INTENT_CREATED
      }, { session: options.session });

      this.logInfo('payment.created', {
        paymentId: normalizeId(payment._id),
        order: normalizeId(payment.order),
        provider: payment.provider,
        status: payment.status
      });

      return payment;
    });
  }

  async createManualPayment(paymentData, options = {}) {
    return this.createPayment({
      ...paymentData,
      provider: paymentData.provider || 'manual_upi',
      paymentMethod: 'UPI'
    }, options);
  }

  async createGatewayPayment(paymentData, options = {}) {
    if (!paymentData.provider) {
      throw new PaymentCreationNotAllowedError({ reason: 'provider is required for gateway payments' });
    }

    return this.createPayment({
      ...paymentData,
      paymentMethod: paymentData.paymentMethod || 'OTHER'
    }, options);
  }

  async createPaymentIntent(intentData, options = {}) {
    return this.execute('createPaymentIntent', async () => {
      const now = options.now || new Date();
      const expiryMinutes = options.expiryMinutes || DEFAULT_INTENT_EXPIRY_MINUTES;
      const orderAmount = options.orderAmount !== undefined ? options.orderAmount : intentData.orderAmount;

      this.validateIntentAmount(intentData.amount, orderAmount);

      if (!(await this.canCreateIntent(intentData.order, options))) {
        this.logWarn('payment_intent.create_blocked', {
          order: normalizeId(intentData.order),
          orderStatus: options.orderStatus
        });
        throw new PaymentCreationNotAllowedError({ order: normalizeId(intentData.order), orderStatus: options.orderStatus });
      }

      const previousActiveIntent = await this.repository.findActiveIntent(intentData.order, {
        session: options.session,
        now
      });

      const expiredIntentResult = await this.repository.expireActiveIntent(intentData.order, {
        session: options.session,
        now,
        reason: 'Replaced by a new payment intent'
      });

      if (previousActiveIntent && expiredIntentResult.modifiedCount > 0) {
        await this.recordLedgerEvent({
          ...previousActiveIntent,
          status: PAYMENT_STATUS.PAYMENT_EXPIRED,
          activeIntent: false
        }, PAYMENT_STATUS.PAYMENT_EXPIRED, {
          previousStatus: previousActiveIntent.status,
          actor: options.actor,
          actorType: options.actorType || 'SYSTEM',
          reason: 'Replaced by a new payment intent',
          session: options.session
        });
      }

      const intent = await this.repository.createIntent({
        order: intentData.order,
        user: intentData.user,
        amount: intentData.amount,
        currency: intentData.currency || 'INR',
        paymentMethod: intentData.paymentMethod || 'UPI',
        provider: intentData.provider || 'manual_upi',
        providerOrderId: intentData.providerOrderId,
        providerPaymentId: intentData.providerPaymentId,
        metadata: intentData.metadata || {},
        expiresAt: options.expiresAt || addMinutes(now, expiryMinutes),
        statusHistory: [{
          status: PAYMENT_STATUS.INTENT_CREATED,
          changedBy: options.actor && options.actor.userId,
          reason: options.reason || 'Payment intent created',
          changedAt: now
        }]
      }, { session: options.session });

      this.logInfo('payment_intent.created', {
        paymentId: normalizeId(intent._id),
        order: normalizeId(intent.order),
        provider: intent.provider,
        expiresAt: intent.expiresAt
      });

      await this.recordLedgerEvent(intent, PAYMENT_STATUS.INTENT_CREATED, {
        previousStatus: null,
        actor: options.actor,
        actorType: options.actorType || 'SYSTEM',
        reason: options.reason || 'Payment intent created',
        metadata: {
          expiresAt: intent.expiresAt
        },
        session: options.session
      });

      await this.publishPaymentEvent(DOMAIN_EVENTS.PAYMENT_INTENT_CREATED, intent, options);

      return intent;
    });
  }

  async getActivePaymentIntent(orderId, options = {}) {
    return this.execute('getActivePaymentIntent', () => this.repository.findActiveIntent(orderId, options));
  }

  validateIntent(intent, expected = {}) {
    this.validatePaymentOwnership(intent, expected);

    if (!intent.activeIntent) {
      throw new PaymentIntentInactiveError({ paymentId: normalizeId(intent._id) });
    }

    this.ensurePaymentNotExpired(intent, expected.now);

    if (expected.amount !== undefined) {
      this.validateIntentAmount(intent.amount, expected.amount);
    }

    return true;
  }

  validateQRCodeGeneration(payment, expected = {}) {
    this.validateIntent(payment, expected);

    const status = toCanonicalStatus(payment.status);
    const allowedStatuses = new Set([
      PAYMENT_STATUS.INTENT_CREATED,
      PAYMENT_STATUS.QR_PENDING,
      PAYMENT_STATUS.QR_GENERATED
    ]);

    if (!allowedStatuses.has(status)) {
      throw new InvalidPaymentTransitionError(status, PAYMENT_STATUS.QR_GENERATED);
    }

    if (expected.amount !== undefined) {
      this.validateIntentAmount(payment.amount, expected.amount);
    }

    return true;
  }

  async canCreateIntent(orderId, options = {}) {
    return this.canCreatePaymentAttempt(orderId, options);
  }

  async cancelIntent(paymentId, actor = {}, options = {}) {
    return this.execute('cancelIntent', async () => {
      const payment = await this.repository.getById(paymentId, { ...options, lean: true });
      this.validateIntent(payment, { orderId: options.orderId, userId: options.userId, now: options.now });
      this.validatePaymentTransition(payment.status, PAYMENT_STATUS.PAYMENT_CANCELLED);

      const updated = await this.repository.updateById(payment._id, {
        $set: {
          status: PAYMENT_STATUS.PAYMENT_CANCELLED,
          activeIntent: false,
          successfulPayment: false
        },
        $push: {
          statusHistory: {
            status: PAYMENT_STATUS.PAYMENT_CANCELLED,
            changedBy: actor.userId,
            reason: options.reason || 'Payment intent cancelled'
          }
        }
      }, { session: options.session });

      this.logInfo('payment_intent.cancelled', {
        paymentId: normalizeId(updated._id),
        order: normalizeId(updated.order)
      });

      await this.recordLedgerEvent(updated, PAYMENT_STATUS.PAYMENT_CANCELLED, {
        previousStatus: payment.status,
        actor,
        actorType: options.actorType || 'SYSTEM',
        reason: options.reason || 'Payment intent cancelled',
        session: options.session
      });

      await this.publishPaymentEvent(DOMAIN_EVENTS.PAYMENT_CANCELLED, updated, {
        ...options,
        actor,
        previousStatus: payment.status
      });

      return updated;
    });
  }

  async getPayment(paymentId, options = {}) {
    return this.execute('getPayment', () => this.repository.getById(paymentId, options));
  }

  async generateQRCode(paymentId, options = {}) {
    return this.execute('generateQRCode', async () => {
      const payment = await this.repository.getById(paymentId, {
        ...options,
        includeSensitive: true,
        lean: true
      });

      this.validateQRCodeGeneration(payment, options);

      if (!options.forceRegenerate && this.hasReusableQRCode(payment, options.now)) {
        this.logInfo('payment_qr.reused', {
          paymentId: normalizeId(payment._id),
          order: normalizeId(payment.order)
        });
        return this.toQRCodeResponse(payment);
      }

      const now = options.now || new Date();
      const qrExpiresAt = this.resolveQRCodeExpiry(payment, options, now);
      const qrPayload = await this.qrService.generate({
        amount: payment.amount,
        currency: payment.currency,
        orderReference: options.orderReference || normalizeId(payment.order),
        intentId: normalizeId(payment._id),
        transactionReference: options.transactionReference || `PAY-${normalizeId(payment._id)}`,
        transactionNote: options.transactionNote || `Order ${options.orderReference || normalizeId(payment.order)}`
      }, options.qrOptions || {});

      this.validatePaymentTransition(payment.status, PAYMENT_STATUS.QR_GENERATED);

      const updated = await this.repository.saveQRCodeMetadata(payment._id, {
        qrPayload: qrPayload.upiUri,
        qrCodeDataUrl: qrPayload.qrCodeDataUrl,
        qrGeneratedAt: now,
        qrExpiresAt,
        status: PAYMENT_STATUS.QR_GENERATED,
        activeIntent: true,
        changedBy: options.actor && options.actor.userId,
        reason: options.reason || 'Dynamic UPI QR generated',
        metadata: {
          provider: qrPayload.provider,
          type: qrPayload.type,
          amount: qrPayload.metadata.amount,
          currency: qrPayload.metadata.currency,
          orderReference: qrPayload.metadata.orderReference,
          intentId: qrPayload.metadata.intentId,
          transactionReference: qrPayload.metadata.transactionReference,
          merchantCode: qrPayload.metadata.merchantCode
        },
        historyMetadata: {
          provider: qrPayload.provider,
          type: qrPayload.type
        }
      }, { session: options.session });

      this.logInfo(options.forceRegenerate ? 'payment_qr.regenerated' : 'payment_qr.generated', {
        paymentId: normalizeId(updated._id),
        order: normalizeId(updated.order),
        qrExpiresAt: updated.qrExpiresAt
      });

      await this.recordLedgerEvent(updated, PAYMENT_STATUS.QR_GENERATED, {
        previousStatus: payment.status,
        actor: options.actor,
        actorType: options.actorType || 'SYSTEM',
        reason: options.reason || 'Dynamic UPI QR generated',
        metadata: {
          qrGeneratedAt: updated.qrGeneratedAt,
          qrExpiresAt: updated.qrExpiresAt,
          orderReference: qrPayload.metadata.orderReference
        },
        session: options.session,
        dedupe: false
      });

      await this.publishPaymentEvent(DOMAIN_EVENTS.QR_CODE_GENERATED, updated, {
        ...options,
        previousStatus: payment.status
      });

      return this.toQRCodeResponse(updated);
    });
  }

  async regenerateQRCode(paymentId, options = {}) {
    return this.generateQRCode(paymentId, {
      ...options,
      forceRegenerate: true,
      reason: options.reason || 'Dynamic UPI QR regenerated'
    });
  }

  async getQRCode(paymentId, options = {}) {
    return this.execute('getQRCode', async () => {
      const payment = await this.repository.findLatestQRCode(paymentId, {
        ...options,
        includeSensitive: true,
        lean: true
      });

      if (!payment || !payment.qrGeneratedAt) {
        throw new PaymentQRCodeUnavailableError({ paymentId: normalizeId(paymentId) });
      }

      this.validateIntent(payment, { orderId: options.orderId, userId: options.userId, amount: options.amount, now: options.now });

      if (!this.hasReusableQRCode(payment, options.now)) {
        this.logWarn('payment_qr.expired', {
          paymentId: normalizeId(payment._id),
          order: normalizeId(payment.order)
        });
        throw new PaymentExpiredError({ paymentId: normalizeId(payment._id), qrExpiresAt: payment.qrExpiresAt });
      }

      return this.toQRCodeResponse(payment);
    });
  }

  async getPaymentByOrder(orderId, options = {}) {
    return this.execute('getPaymentByOrder', () => this.repository.findByOrder(orderId, options));
  }

  async listPaymentAttempts(orderId, pagination = {}, options = {}) {
    return this.execute('listPaymentAttempts', () => this.repository.listPaymentAttempts(orderId, pagination, options));
  }

  async submitUTR(paymentId, utr, actor = {}, options = {}) {
    return this.execute('submitUTR', async () => {
      const normalizedUTR = this.validateUTR(utr);
      const payment = await this.repository.getById(paymentId, { ...options, lean: true });
      this.validatePaymentOwnership(payment, actor);
      this.validateIntent(payment, { orderId: actor.orderId, userId: actor.userId, now: options.now });
      this.ensurePaymentNotExpired(payment, options.now);
      this.ensurePaymentIsNotCompleted(payment);

      if (payment.utr) {
        throw new PaymentUTRAlreadySubmittedError({
          paymentId: normalizeId(payment._id),
          maskedUtr: maskReference(payment.utr)
        });
      }

      if (await this.repository.existsByUTR(normalizedUTR, { session: options.session })) {
        this.logWarn('payment.duplicate_utr', {
          paymentId: normalizeId(payment._id),
          maskedUtr: maskReference(normalizedUTR)
        });
        throw new DuplicateUTRError({ maskedUtr: maskReference(normalizedUTR) });
      }

      this.validatePaymentTransition(payment.status, PAYMENT_STATUS.PAYMENT_SUBMITTED);
      this.validatePaymentTransition(PAYMENT_STATUS.PAYMENT_SUBMITTED, PAYMENT_STATUS.VERIFICATION_PENDING);

      const updated = await this.repository.submitUTR(payment._id, {
        utr: normalizedUTR,
        submittedBy: actor.userId,
        submittedAt: options.now || new Date(),
        submissionReason: options.reason || 'Manual UTR submitted',
        verificationReason: 'Manual UTR awaiting verification'
      }, { session: options.session });

      this.logInfo('payment.utr_submitted', {
        paymentId: normalizeId(updated._id),
        order: normalizeId(updated.order),
        maskedUtr: maskReference(normalizedUTR)
      });

      await this.recordLedgerEvent(updated, PAYMENT_STATUS.PAYMENT_SUBMITTED, {
        previousStatus: payment.status,
        actor,
        actorType: options.actorType || 'CUSTOMER',
        reason: options.reason || 'Manual UTR submitted',
        reference: normalizedUTR,
        session: options.session
      });
      await this.recordLedgerEvent(updated, PAYMENT_STATUS.VERIFICATION_PENDING, {
        previousStatus: PAYMENT_STATUS.PAYMENT_SUBMITTED,
        actor,
        actorType: options.actorType || 'CUSTOMER',
        reason: 'Manual UTR awaiting verification',
        reference: normalizedUTR,
        session: options.session
      });

      await this.publishPaymentEvent(DOMAIN_EVENTS.PAYMENT_SUBMITTED, updated, {
        ...options,
        actor,
        previousStatus: payment.status
      });

      return updated;
    });
  }

  async submitManualUTR(paymentId, utr, actor = {}, options = {}) {
    return this.submitUTR(paymentId, utr, actor, options);
  }

  async verifyPayment(paymentId, verifier = {}, options = {}) {
    return this.execute('verifyPayment', async () => {
      const payment = await this.repository.getById(paymentId, { ...options, lean: true });
      this.canVerifyPayment(payment, verifier, options);

      const successfulPayment = await this.repository.findSuccessfulPayment(payment.order, { session: options.session });
      if (successfulPayment && normalizeId(successfulPayment._id) !== normalizeId(payment._id)) {
        throw new PaymentAlreadyVerifiedError({ order: normalizeId(payment.order) });
      }

      const currentStatus = toCanonicalStatus(payment.status);
      if (currentStatus === PAYMENT_STATUS.PAYMENT_SUBMITTED) {
        this.validatePaymentTransition(payment.status, PAYMENT_STATUS.VERIFICATION_PENDING);
      } else {
        this.validatePaymentTransition(payment.status, PAYMENT_STATUS.PAYMENT_VERIFIED);
      }

      this.logInfo('payment.verification_started', {
        paymentId: normalizeId(payment._id),
        order: normalizeId(payment.order),
        verifier: normalizeId(verifier.userId)
      });

      const updated = await this.repository.verifyPayment(payment._id, {
        verifiedBy: verifier.userId,
        verifiedAt: options.now || new Date(),
        reason: options.reason || 'Manual payment verified',
        includeVerificationPending: currentStatus === PAYMENT_STATUS.PAYMENT_SUBMITTED,
        verificationReason: 'Manual payment moved to verification'
      }, { session: options.session });

      this.logInfo('payment.verified', {
        paymentId: normalizeId(updated._id),
        order: normalizeId(updated.order),
        verifier: verifier.userId ? normalizeId(verifier.userId) : undefined
      });

      await this.recordLedgerEvent(updated, PAYMENT_STATUS.PAYMENT_VERIFIED, {
        previousStatus: currentStatus,
        actor: verifier,
        actorType: options.actorType || 'ADMIN',
        reason: options.reason || 'Manual payment verified',
        reference: payment.utr,
        session: options.session
      });

      await this.publishPaymentEvent(DOMAIN_EVENTS.PAYMENT_VERIFIED, updated, {
        ...options,
        actor: verifier,
        previousStatus: currentStatus
      });

      return updated;
    });
  }

  async verifyManualPayment(paymentId, verifier = {}, options = {}) {
    return this.verifyPayment(paymentId, verifier, options);
  }

  async rejectPayment(paymentId, rejector = {}, options = {}) {
    return this.execute('rejectPayment', async () => {
      const payment = await this.repository.getById(paymentId, { ...options, lean: true });
      this.canVerifyPayment(payment, rejector, options);

      const currentStatus = toCanonicalStatus(payment.status);
      const nextStatus = PAYMENT_STATUS.PAYMENT_REJECTED;
      if (![PAYMENT_STATUS.PAYMENT_SUBMITTED, PAYMENT_STATUS.VERIFICATION_PENDING].includes(currentStatus)) {
        this.validatePaymentTransition(payment.status, nextStatus);
      }

      const updated = await this.repository.rejectPayment(payment._id, {
        rejectedBy: rejector.userId,
        rejectedAt: options.now || new Date(),
        reason: options.reason || 'Manual payment rejected'
      }, { session: options.session });

      this.logWarn('payment.rejected', {
        paymentId: normalizeId(updated._id),
        order: normalizeId(updated.order)
      });

      await this.recordLedgerEvent(updated, PAYMENT_STATUS.PAYMENT_REJECTED, {
        previousStatus: currentStatus,
        actor: rejector,
        actorType: options.actorType || 'ADMIN',
        reason: options.reason || 'Manual payment rejected',
        reference: payment.utr,
        session: options.session
      });

      await this.publishPaymentEvent(DOMAIN_EVENTS.PAYMENT_REJECTED, updated, {
        ...options,
        actor: rejector,
        previousStatus: currentStatus
      });

      return updated;
    }).catch((error) => {
      if (error instanceof PaymentServiceError) throw error;
      throw new PaymentVerificationRejectedError({ paymentId });
    });
  }

  async rejectManualPayment(paymentId, rejector = {}, options = {}) {
    return this.rejectPayment(paymentId, rejector, options);
  }

  validateUTR(utr) {
    const normalizedUTR = String(utr || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{6,64}$/.test(normalizedUTR)) {
      throw new InvalidUTRError({ maskedUtr: maskReference(normalizedUTR) });
    }

    return normalizedUTR;
  }

  canVerifyPayment(payment, verifier = {}, options = {}) {
    if (!verifier.userId) {
      throw new PaymentVerificationAuthorizationError({ paymentId: normalizeId(payment._id) });
    }

    this.validatePaymentOwnership(payment, options);
    this.ensurePaymentNotExpired(payment, options.now);
    this.ensurePaymentIsNotCompleted(payment);

    if (!payment.activeIntent) {
      throw new PaymentIntentInactiveError({ paymentId: normalizeId(payment._id) });
    }

    const status = toCanonicalStatus(payment.status);
    if (![PAYMENT_STATUS.PAYMENT_SUBMITTED, PAYMENT_STATUS.VERIFICATION_PENDING].includes(status)) {
      throw new InvalidPaymentTransitionError(status, PAYMENT_STATUS.PAYMENT_VERIFIED);
    }

    return true;
  }

  async getPendingVerifications(pagination = {}, options = {}) {
    return this.execute('getPendingVerifications', () => this.repository.findByVerificationStatus(
      [PAYMENT_STATUS.PAYMENT_SUBMITTED, PAYMENT_STATUS.VERIFICATION_PENDING],
      pagination,
      { ...options, activeIntent: true }
    ));
  }

  async expirePaymentIntent(paymentId, options = {}) {
    return this.transitionPayment(paymentId, PAYMENT_STATUS.PAYMENT_EXPIRED, {
      ...options,
      reason: options.reason || 'Payment intent expired',
      logEvent: 'payment_intent.expired',
      activeIntent: false
    });
  }

  async cancelPayment(paymentId, actor = {}, options = {}) {
    return this.transitionPayment(paymentId, PAYMENT_STATUS.PAYMENT_CANCELLED, {
      ...options,
      actor,
      reason: options.reason || 'Payment cancelled',
      logEvent: 'payment.cancelled'
    });
  }

  async markPaymentFailed(paymentId, actor = {}, options = {}) {
    return this.transitionPayment(paymentId, PAYMENT_STATUS.PAYMENT_FAILED, {
      ...options,
      actor,
      reason: options.reason || 'Payment failed',
      logEvent: 'payment.failed'
    });
  }

  async markPaymentSuccessful(paymentId, actor = {}, options = {}) {
    return this.execute('markPaymentSuccessful', async () => {
      const payment = await this.repository.getById(paymentId, { ...options, lean: true });
      this.ensurePaymentNotExpired(payment, options.now);
      this.ensurePaymentIsNotCompleted(payment);

      const successfulPayment = await this.repository.findSuccessfulPayment(payment.order, { session: options.session });
      if (successfulPayment && normalizeId(successfulPayment._id) !== normalizeId(payment._id)) {
        throw new PaymentAlreadyVerifiedError({ order: normalizeId(payment.order) });
      }

      this.validatePaymentTransition(payment.status, PAYMENT_STATUS.PAYMENT_VERIFIED);

      const updated = await this.repository.updateById(payment._id, {
        $set: {
          status: PAYMENT_STATUS.PAYMENT_VERIFIED,
          successfulPayment: true,
          activeIntent: false,
          verifiedAt: new Date(),
          verifiedBy: actor.userId
        },
        $push: {
          statusHistory: {
            status: PAYMENT_STATUS.PAYMENT_VERIFIED,
            changedBy: actor.userId,
            reason: options.reason || 'Payment marked successful'
          }
        }
      }, { session: options.session });

      this.logInfo('payment.successful', {
        paymentId: normalizeId(updated._id),
        order: normalizeId(updated.order)
      });

      await this.recordLedgerEvent(updated, PAYMENT_STATUS.PAYMENT_VERIFIED, {
        previousStatus: payment.status,
        actor,
        actorType: options.actorType || 'ADMIN',
        reason: options.reason || 'Payment marked successful',
        reference: payment.utr,
        session: options.session
      });

      await this.publishPaymentEvent(DOMAIN_EVENTS.PAYMENT_VERIFIED, updated, {
        ...options,
        actor,
        previousStatus: payment.status
      });

      return updated;
    });
  }

  async findActivePayment(orderId, options = {}) {
    return this.execute('findActivePayment', () => this.repository.findActivePaymentIntent(orderId, options));
  }

  async canCreatePaymentAttempt(orderId, options = {}) {
    return this.execute('canCreatePaymentAttempt', async () => {
      if (options.orderStatus && ['CANCELLED', 'REFUNDED', 'COMPLETED'].includes(String(options.orderStatus).toUpperCase())) {
        return false;
      }

      return !(await this.repository.existsSuccessfulPayment(orderId, { session: options.session }));
    });
  }

  validatePaymentOwnership(payment, expected = {}) {
    if (expected.orderId && normalizeId(payment.order) !== normalizeId(expected.orderId)) {
      throw new PaymentOwnershipError({ expectedOrder: normalizeId(expected.orderId), actualOrder: normalizeId(payment.order) });
    }

    if (expected.userId && normalizeId(payment.user) !== normalizeId(expected.userId)) {
      throw new PaymentOwnershipError({ expectedUser: normalizeId(expected.userId), actualUser: normalizeId(payment.user) });
    }

    return true;
  }

  validatePaymentTransition(currentStatus, nextStatus) {
    const from = toCanonicalStatus(currentStatus);
    const to = toCanonicalStatus(nextStatus);
    const allowed = ALLOWED_TRANSITIONS[from] || [];

    if (!allowed.includes(to)) {
      throw new InvalidPaymentTransitionError(from, to);
    }

    return true;
  }

  async transitionPayment(paymentId, nextStatus, options = {}) {
    return this.execute('transitionPayment', async () => {
      const payment = await this.repository.getById(paymentId, { ...options, lean: true });

      if (SUCCESS_STATUSES.has(toCanonicalStatus(payment.status))) {
        throw new PaymentAlreadyCompletedError({ paymentId: normalizeId(payment._id), status: payment.status });
      }

      if (nextStatus !== PAYMENT_STATUS.PAYMENT_EXPIRED) {
        this.ensurePaymentNotExpired(payment, options.now);
      }

      this.validatePaymentTransition(payment.status, nextStatus);

      const updated = await this.repository.updateById(payment._id, {
        $set: {
          status: nextStatus,
          activeIntent: options.activeIntent !== undefined ? options.activeIntent : false,
          successfulPayment: SUCCESS_STATUSES.has(toCanonicalStatus(nextStatus)),
          ...(nextStatus === PAYMENT_STATUS.PAYMENT_FAILED && { failureReason: options.reason || 'Payment failed' })
        },
        $push: {
          statusHistory: {
            status: nextStatus,
            changedBy: options.actor && options.actor.userId,
            reason: options.reason
          }
        }
      }, { session: options.session });

      this.logInfo(options.logEvent || 'payment.transitioned', {
        paymentId: normalizeId(updated._id),
        order: normalizeId(updated.order),
        status: updated.status
      });

      await this.recordLedgerEvent(updated, nextStatus, {
        previousStatus: payment.status,
        actor: options.actor,
        actorType: options.actorType || 'SYSTEM',
        reason: options.reason,
        reference: payment.utr,
        session: options.session
      });

      await this.publishPaymentEvent(this.eventForPaymentStatus(nextStatus), updated, {
        ...options,
        previousStatus: payment.status
      });

      return updated;
    });
  }

  async assertCanCreatePaymentAttempt(orderId, options = {}) {
    const canCreate = await this.canCreatePaymentAttempt(orderId, options);
    if (!canCreate) {
      this.logWarn('payment.create_blocked', { order: normalizeId(orderId), orderStatus: options.orderStatus });
      throw new PaymentCreationNotAllowedError({ order: normalizeId(orderId), orderStatus: options.orderStatus });
    }
  }

  ensurePaymentIsNotCompleted(payment) {
    const status = toCanonicalStatus(payment.status);
    if (SUCCESS_STATUSES.has(status) || TERMINAL_STATUSES.has(status)) {
      if (status === PAYMENT_STATUS.PAYMENT_VERIFIED) {
        throw new PaymentAlreadyVerifiedError({ paymentId: normalizeId(payment._id) });
      }
      throw new PaymentAlreadyCompletedError({ paymentId: normalizeId(payment._id), status });
    }
  }

  ensurePaymentNotExpired(payment, now = new Date()) {
    if (toCanonicalStatus(payment.status) === PAYMENT_STATUS.PAYMENT_EXPIRED || isExpired(payment, now)) {
      throw new PaymentExpiredError({ paymentId: normalizeId(payment._id), expiresAt: payment.expiresAt });
    }
  }

  validateIntentAmount(intentAmount, orderAmount) {
    if (orderAmount === undefined || orderAmount === null) {
      return true;
    }

    if (Number(intentAmount) !== Number(orderAmount)) {
      throw new PaymentIntentAmountMismatchError({
        intentAmount: Number(intentAmount),
        orderAmount: Number(orderAmount)
      });
    }

    return true;
  }

  hasReusableQRCode(payment, now = new Date()) {
    return Boolean(
      payment.qrPayload &&
      payment.qrCodeDataUrl &&
      payment.qrGeneratedAt &&
      payment.qrExpiresAt &&
      new Date(payment.qrExpiresAt) > now
    );
  }

  resolveQRCodeExpiry(payment, options = {}, now = new Date()) {
    const requestedExpiry = options.qrExpiresAt || (options.qrExpiryMinutes && addMinutes(now, options.qrExpiryMinutes));
    const qrExpiresAt = requestedExpiry ? new Date(requestedExpiry) : new Date(payment.expiresAt || addMinutes(now, DEFAULT_INTENT_EXPIRY_MINUTES));

    if (payment.expiresAt && qrExpiresAt > new Date(payment.expiresAt)) {
      return new Date(payment.expiresAt);
    }

    return qrExpiresAt;
  }

  toQRCodeResponse(payment) {
    return {
      paymentId: normalizeId(payment._id),
      order: normalizeId(payment.order),
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      upiUri: payment.qrPayload,
      qrImage: payment.qrCodeDataUrl,
      qrCodeDataUrl: payment.qrCodeDataUrl,
      qrGeneratedAt: payment.qrGeneratedAt,
      qrExpiresAt: payment.qrExpiresAt,
      metadata: payment.qrMetadata || {}
    };
  }

  async recordLedgerEvent(payment, eventType, options = {}) {
    if (!this.ledgerRepository) {
      return null;
    }

    const actor = options.actor || {};
    const currentStatus = options.currentStatus || eventType;
    const ledgerEntry = {
      eventKey: options.dedupe === false ? undefined : this.buildLedgerEventKey(payment, eventType, currentStatus, options.reference),
      paymentId: payment._id,
      orderId: payment.order,
      userId: payment.user,
      eventType,
      previousStatus: options.previousStatus,
      currentStatus,
      amount: payment.amount,
      currency: payment.currency || 'INR',
      provider: payment.provider,
      reference: options.reference,
      actor: actor.userId,
      actorType: this.resolveActorType(options.actorType, actor),
      reason: options.reason,
      metadata: options.metadata || {}
    };

    const ledger = await this.ledgerRepository.createEntry(ledgerEntry, {
      session: options.session
    });

    this.logInfo('payment_ledger.entry_created', {
      ledgerId: ledger.ledgerId,
      paymentId: normalizeId(payment._id),
      order: normalizeId(payment.order),
      eventType,
      reference: maskReference(options.reference)
    });

    await eventBus.publish(DOMAIN_EVENTS.LEDGER_CREATED, {
      ledgerId: ledger.ledgerId,
      ledgerType: 'payment',
      paymentId: normalizeId(payment._id),
      orderId: normalizeId(payment.order),
      userId: normalizeId(payment.user),
      eventType,
      currentStatus,
      previousStatus: options.previousStatus
    }, {
      session: options.session,
      correlationId: options.correlationId,
      idempotencyKey: `PaymentLedger:${ledger.ledgerId}`
    });

    return ledger;
  }

  async publishPaymentEvent(eventName, payment, options = {}) {
    if (!eventName) return null;

    return eventBus.publish(eventName, {
      paymentId: normalizeId(payment._id),
      orderId: normalizeId(payment.order),
      userId: normalizeId(payment.user),
      amount: payment.amount,
      currency: payment.currency,
      provider: payment.provider,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      previousStatus: options.previousStatus,
      actorId: options.actor && options.actor.userId ? normalizeId(options.actor.userId) : undefined,
      actorType: options.actorType,
      reason: options.reason
    }, {
      session: options.session,
      correlationId: options.correlationId,
      idempotencyKey: `${eventName}:${normalizeId(payment._id)}:${payment.status}:${options.previousStatus || ''}`
    });
  }

  eventForPaymentStatus(status) {
    const canonicalStatus = toCanonicalStatus(status);
    const mapping = {
      [PAYMENT_STATUS.PAYMENT_EXPIRED]: DOMAIN_EVENTS.PAYMENT_EXPIRED,
      [PAYMENT_STATUS.PAYMENT_CANCELLED]: DOMAIN_EVENTS.PAYMENT_CANCELLED,
      [PAYMENT_STATUS.PAYMENT_FAILED]: DOMAIN_EVENTS.PAYMENT_FAILED,
      [PAYMENT_STATUS.PAYMENT_VERIFIED]: DOMAIN_EVENTS.PAYMENT_VERIFIED,
      [PAYMENT_STATUS.PAYMENT_REJECTED]: DOMAIN_EVENTS.PAYMENT_REJECTED
    };

    return mapping[canonicalStatus];
  }

  buildLedgerEventKey(payment, eventType, currentStatus, reference) {
    return [
      normalizeId(payment._id),
      eventType,
      currentStatus,
      reference ? String(reference).trim().toUpperCase() : ''
    ].join(':');
  }

  resolveActorType(actorType, actor = {}) {
    if (actorType) {
      return String(actorType).trim().toUpperCase();
    }

    if (actor.userId) {
      return 'UNKNOWN';
    }

    return 'SYSTEM';
  }

  mapRepositoryError(error, operation) {
    if (error instanceof DuplicateSuccessfulPaymentError) {
      return new PaymentAlreadyVerifiedError(error.details);
    }

    if (error instanceof DuplicateActivePaymentIntentError) {
      return new PaymentCreationNotAllowedError(error.details);
    }

    if (error instanceof DuplicatePaymentReferenceError) {
      if (error.details && error.details.field === 'utr') {
        return new DuplicateUTRError({ maskedUtr: maskReference(error.details.value) });
      }
      return new PaymentServiceError(error.message, error.code, error.details);
    }

    if (error instanceof PaymentNotFoundError || error instanceof InvalidPaymentIdError) {
      return new PaymentServiceError(error.message, error.code, error.details);
    }

    if (error instanceof PaymentRepositoryError) {
      return new PaymentDataAccessError('Payment repository operation failed', {
        operation,
        repositoryCode: error.code
      });
    }

    if (error instanceof PaymentLedgerRepositoryError) {
      return new PaymentDataAccessError('Payment ledger operation failed', {
        operation,
        repositoryCode: error.code
      });
    }

    if (error && (error.code === 'QR_CONFIGURATION_ERROR' || error.code === 'QR_VALIDATION_ERROR')) {
      return new PaymentQRCodeGenerationError(error.message, error.details);
    }

    return error;
  }

  async execute(operation, handler) {
    try {
      return await handler();
    } catch (error) {
      const mappedError = this.mapRepositoryError(error, operation);
      if (mappedError instanceof PaymentServiceError) {
        this.logWarn('payment.service_error', {
          operation,
          code: mappedError.code
        });
      }
      throw mappedError;
    }
  }

  logInfo(event, metadata = {}) {
    this.logger.info(event, metadata);
  }

  logWarn(event, metadata = {}) {
    this.logger.warn(event, metadata);
  }
}

module.exports = new PaymentService();
module.exports.PaymentService = PaymentService;
module.exports.PAYMENT_STATUS = PAYMENT_STATUS;
module.exports.ALLOWED_TRANSITIONS = ALLOWED_TRANSITIONS;
module.exports.PaymentServiceError = PaymentServiceError;
module.exports.PaymentAlreadyCompletedError = PaymentAlreadyCompletedError;
module.exports.InvalidPaymentTransitionError = InvalidPaymentTransitionError;
module.exports.PaymentOwnershipError = PaymentOwnershipError;
module.exports.PaymentExpiredError = PaymentExpiredError;
module.exports.PaymentAlreadyVerifiedError = PaymentAlreadyVerifiedError;
module.exports.PaymentVerificationRejectedError = PaymentVerificationRejectedError;
module.exports.DuplicateUTRError = DuplicateUTRError;
module.exports.InvalidUTRError = InvalidUTRError;
module.exports.PaymentUTRAlreadySubmittedError = PaymentUTRAlreadySubmittedError;
module.exports.PaymentVerificationAuthorizationError = PaymentVerificationAuthorizationError;
module.exports.PaymentCreationNotAllowedError = PaymentCreationNotAllowedError;
module.exports.PaymentIntentAmountMismatchError = PaymentIntentAmountMismatchError;
module.exports.PaymentIntentInactiveError = PaymentIntentInactiveError;
module.exports.PaymentQRCodeGenerationError = PaymentQRCodeGenerationError;
module.exports.PaymentQRCodeUnavailableError = PaymentQRCodeUnavailableError;
module.exports.PaymentDataAccessError = PaymentDataAccessError;

const { endpointInventory } = require('./apiInventory');
const { EVENT_CATALOG } = require('../events/eventCatalog');

const successExample = {
  success: true,
  data: {}
};

const errorExample = {
  success: false,
  message: 'Error message'
};

const schemas = {
  ApiSuccess: {
    type: 'object',
    properties: {
      success: { type: 'boolean', examples: [true] },
      data: { type: 'object' },
      message: { type: 'string' }
    }
  },
  ApiError: {
    type: 'object',
    required: ['message'],
    properties: {
      success: { type: 'boolean', examples: [false] },
      status: { type: 'string', examples: ['error'] },
      message: { type: 'string' },
      stack: { type: 'string', description: 'Development only.' }
    }
  },
  RegisterRequest: {
    type: 'object',
    required: ['name', 'email', 'password'],
    properties: {
      name: { type: 'string', minLength: 2 },
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 6 },
      role: { type: 'string', enum: ['reader', 'author', 'admin'] }
    }
  },
  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' }
    }
  },
  OrderCreateRequest: {
    type: 'object',
    required: ['items', 'shippingAddress'],
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['book', 'quantity'],
          properties: {
            book: { type: 'string' },
            quantity: { type: 'integer', minimum: 1 }
          }
        }
      },
      shippingAddress: { type: 'object' },
      paymentMethod: { type: 'string', examples: ['UPI'] }
    }
  },
  PaymentVerificationRequest: {
    type: 'object',
    required: ['utr'],
    properties: {
      utr: { type: 'string', pattern: '^[A-Z0-9-]{6,64}$' }
    }
  },
  StatusUpdateRequest: {
    type: 'object',
    properties: {
      status: { type: 'string' },
      reason: { type: 'string' }
    }
  },
  RejectPaymentRequest: {
    type: 'object',
    properties: {
      reason: { type: 'string', maxLength: 500 }
    }
  },
  UserUpdateRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string', format: 'email' }
    }
  },
  WishlistRequest: {
    type: 'object',
    required: ['bookId'],
    properties: {
      bookId: { type: 'string' }
    }
  },
  BookCreateRequest: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      author: { type: 'string' },
      price: { type: 'number' },
      stock: { type: 'integer' }
    }
  },
  BookUpdateRequest: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      price: { type: 'number' },
      stock: { type: 'integer' }
    }
  },
  PublishRequestCreate: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      manuscript: { type: 'string' },
      package: { type: 'string' }
    }
  },
  CourierAssignRequest: {
    type: 'object',
    properties: {
      courierCode: { type: 'string' },
      trackingNumber: { type: 'string' }
    }
  },
  MultipartImageRequest: {
    type: 'object',
    properties: { image: { type: 'string', format: 'binary' } }
  },
  MultipartDocumentRequest: {
    type: 'object',
    properties: { document: { type: 'string', format: 'binary' } }
  }
};

function toOperationId(endpoint) {
  return `${endpoint.method.toLowerCase()}_${endpoint.path.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
}

function parameterFor(name) {
  return {
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' }
  };
}

function queryFor(name) {
  return {
    name,
    in: 'query',
    required: false,
    schema: name === 'page' || name === 'limit' ? { type: 'integer', minimum: 1 } : { type: 'string' }
  };
}

function requestBodyFor(endpoint) {
  if (!endpoint.body) return undefined;
  const isMultipart = endpoint.body.startsWith('Multipart');
  return {
    required: !endpoint.body.includes('Update'),
    content: {
      [isMultipart ? 'multipart/form-data' : 'application/json']: {
        schema: { $ref: `#/components/schemas/${endpoint.body}` }
      }
    }
  };
}

function securityFor(endpoint) {
  return endpoint.auth === 'Public' ? [] : [{ bearerAuth: [] }];
}

function buildOpenApiSpec() {
  const paths = {};

  for (const endpoint of endpointInventory) {
    paths[endpoint.path] = paths[endpoint.path] || {};
    const body = requestBodyFor(endpoint);
    paths[endpoint.path][endpoint.method.toLowerCase()] = {
      tags: [endpoint.tag],
      summary: endpoint.summary,
      description: `${endpoint.summary}. Controller: ${endpoint.controller}. Authentication: ${endpoint.auth}. ${endpoint.notes || ''}`.trim(),
      operationId: toOperationId(endpoint),
      security: securityFor(endpoint),
      parameters: [
        ...(endpoint.params || []).map(parameterFor),
        ...(endpoint.query || []).map(queryFor)
      ],
      ...(body ? { requestBody: body } : {}),
      responses: {
        200: {
          description: 'Successful response.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' }, examples: { success: { value: successExample } } } }
        },
        201: {
          description: 'Created successfully where applicable.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } }
        },
        400: { $ref: '#/components/responses/BadRequest' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        429: { $ref: '#/components/responses/RateLimited' },
        500: { $ref: '#/components/responses/InternalServerError' }
      }
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'HM Backend API',
      version: '1.0.0',
      description: 'Production API documentation generated from the Express route inventory.'
    },
    servers: [
      { url: 'http://localhost:5000', description: 'Development' },
      { url: 'https://staging.example.com', description: 'Staging' },
      { url: 'https://api.example.com', description: 'Production' }
    ],
    tags: [...new Set(endpointInventory.map((endpoint) => endpoint.tag))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas,
      responses: {
        BadRequest: { description: 'Invalid input or business rule failure.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' }, examples: { error: { value: errorExample } } } } },
        Unauthorized: { description: 'Missing or invalid bearer token.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        Forbidden: { description: 'Authenticated user does not have the required role.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        NotFound: { description: 'Resource or route not found.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        RateLimited: { description: 'Rate limit exceeded.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        InternalServerError: { description: 'Unexpected server error.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
      }
    },
    security: [{ bearerAuth: [] }],
    'x-event-catalog': EVENT_CATALOG
  };
}

module.exports = { buildOpenApiSpec, schemas };

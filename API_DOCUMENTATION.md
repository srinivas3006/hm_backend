# HomeMatch Backend API Documentation & Readiness Report

## 1. Production Readiness Check

The backend is well-structured and incorporates several production-ready features:
- **Security**: Implements `helmet` for HTTP headers, `cors` for Cross-Origin Resource Sharing, and `bcryptjs` for password hashing.
- **Rate Limiting**: Global rate limiting (100 requests / 15 mins) and strict auth rate limiting (10 requests / 15 mins) using `express-rate-limit`.
- **Database**: Uses `mongoose` with transaction support for critical operations like Order Creation (decrementing stock atomically).
- **Error Handling**: Centralized error handling middleware with Winston logging (via `morgan`). Unhandled rejections and exceptions are caught.
- **Performance**: Response compression is enabled using `compression`.
- **Payments**: Uses a secure UPI generation method via QR code, separating intent from manual verification via UTR.
- **Storage**: Integrates with AWS S3 via presigned URLs for secure, direct-from-client uploads.

### What is Working:
- **Authentication**: JWT-based register, login, and profile fetching.
- **Books**: Fetching, filtering (by category/price), pagination, sorting, and full-text search.
- **Orders**: Secure checkout with atomic stock updates, UPI QR code generation, and UTR-based payment verification.
- **Admin**: Dashboard analytics, book management (CRUD).
- **Uploads**: AWS S3 presigned URL generation.

---

## 2. API Endpoints

### 2.1 Authentication (`/api/auth`)

#### Register User
- **URL:** `POST /api/auth/register`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "securepassword",
    "role": "reader" // optional: 'visitor', 'reader', 'author', 'admin'
  }
  ```
- **Response:** `201 Created` with JWT token.

#### Login User
- **URL:** `POST /api/auth/login`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "john@example.com",
    "password": "securepassword"
  }
  ```
- **Response:** `200 OK` with JWT token.

#### Get Current User
- **URL:** `GET /api/auth/me`
- **Access:** Private (Requires Bearer Token)
- **Response:** `200 OK` with user details.

---

### 2.2 Books & Search (`/api/books`, `/api/search`)

#### Get All Books
- **URL:** `GET /api/books`
- **Access:** Public
- **Query Params:** `category`, `minPrice`, `maxPrice`, `sort` (`newest`, `price_asc`, `price_desc`), `page`, `limit`.
- **Response:** `200 OK` with list of published books and pagination metadata.

#### Get Book by Slug
- **URL:** `GET /api/books/:slug`
- **Access:** Public
- **Response:** `200 OK` with populated book details.

#### Search Books
- **URL:** `GET /api/search`
- **Access:** Public
- **Query Params:** `q` (search term), `page`, `limit`.
- **Response:** `200 OK` with text-indexed search results sorted by relevance score.

---

### 2.3 Orders (`/api/orders`)

#### Checkout / Create Order
- **URL:** `POST /api/orders/checkout`
- **Access:** Private
- **Request Body:**
  ```json
  {
    "items": [
      { "bookId": "64abcd123...", "quantity": 1 }
    ],
    "shippingAddress": {
      "fullName": "John Doe",
      "addressLine1": "123 Main St",
      "city": "Mumbai",
      "postalCode": "400001",
      "country": "India"
    }
  }
  ```
- **Response:** `201 Created` with Order info and **UPI QR Code** (`qrCodeDataUrl`).

#### Verify Payment
- **URL:** `PUT /api/orders/:id/verify-payment`
- **Access:** Private
- **Request Body:**
  ```json
  {
    "utr": "123456789012"
  }
  ```
- **Response:** `200 OK` (updates order with UTR for manual admin approval).

#### Track Order
- **URL:** `GET /api/orders/track/:orderNumber`
- **Access:** Public
- **Response:** `200 OK` with tracking updates and order status.

---

### 2.4 Admin (`/api/admin`)

*(All routes require `Bearer Token` and `admin` role)*

- **GET `/api/admin/analytics`**: Returns total revenue, orders, books sold, and inventory.
- **POST `/api/admin/books`**: Create a new book.
- **PUT `/api/admin/books/:id`**: Update a book.
- **DELETE `/api/admin/books/:id`**: Delete a book.

---

### 2.5 Uploads (`/api/uploads`)

#### Get Presigned URL (For S3)
- **URL:** `GET /api/uploads/presigned-url`
- **Access:** Private (Author/Admin)
- **Query Params:** `fileName`, `fileType` (e.g., `image/jpeg`).
- **Response:** `200 OK` with `presignedUrl` and `publicUrl`.

---

## 3. Frontend Connection Architecture

To connect your frontend (e.g., React, Next.js, Vue) to this backend, follow this architecture:

### 1. HTTP Client Setup (Axios)
Create an Axios instance that automatically attaches the JWT token to requests.

```javascript
// api/axios.js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
});

// Add interceptor to inject token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### 2. State Management (Auth)
- Upon calling `/api/auth/login`, save the `token` to `localStorage` (or secure cookies) and user data to global state (Redux/Zustand/Context).
- On app load, if a token exists, fetch `/api/auth/me` to restore the user session.

### 3. Payment Flow Integration
The checkout flow uses a manual UPI verification step:
1. **Cart Submission:** Frontend sends cart items to `/api/orders/checkout`.
2. **Display QR:** Backend returns `data.payment.qrCodeDataUrl`. Frontend displays this Base64 image in an `<img>` tag for the user to scan and pay.
3. **UTR Submission:** Show an input field asking the user for the 12-digit UPI UTR number after they pay.
4. **Verification:** Submit the UTR to `/api/orders/:id/verify-payment`. Order goes to `PENDING` waiting for admin approval.

### 4. File Upload Flow (Images/Covers)
Do not send images through the Node.js server. Use the presigned URL approach:
1. Frontend selects a file.
2. Frontend calls `GET /api/uploads/presigned-url?fileName=cover.jpg&fileType=image/jpeg`.
3. Backend returns a `presignedUrl`.
4. Frontend makes a `PUT` request directly to the `presignedUrl` with the raw file data using Axios or Fetch.
5. Frontend saves the returned `publicUrl` to the Book's `coverImage` field via `/api/admin/books`.

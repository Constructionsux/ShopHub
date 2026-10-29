# 🛒 ShopHub - Modern Full-Stack E-Commerce Platform

![Python](https://img.shields.io/badge/Python-3.12+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit_Site-brightgreen.svg)](https://shophub-5slx.onrender.com/)

**ShopHub** is a production-ready, role-based e-commerce marketplace designed to connect buyers and sellers seamlessly. Built with performance, security, and scalability in mind, it features a fully responsive frontend, a high-speed asynchronous backend, atomic database transactions, and real-time notification systems. 

This project serves as a comprehensive demonstration of modern full-stack development, showcasing clean architecture, robust data management, and enterprise-grade security practices.

---

## 🎯 Purpose & Vision

The primary purpose of ShopHub is to provide a secure, intuitive, and highly performant marketplace. Unlike basic CRUD applications, ShopHub implements real-world e-commerce complexities:
- **Role-Based Access Control (RBAC)**: Strict, secure separation between Buyer and Seller workflows.
- **Security First**: Email verification, new-device login alerts, and rate-limited password resets.
- **Data Integrity**: Atomic database transactions during checkout to prevent race conditions and overselling.
- **Developer Experience**: Clean, modular code structure, comprehensive activity logging, and easy cloud deployment.

---

## 🚀 Key Features

### 👤 For Buyers
- **Smart Marketplace**: Advanced search, category filtering, and dynamic sorting (Bestsellers, Price, Newest).
- **Seamless Checkout**: Auto-filled shipping details from profile, dynamic fee calculation, and secure mock payment processing.
- **Order Management**: Real-time order tracking and a verified-purchase-only **Rating & Review System**.
- **Profile Management**: Save default shipping and billing addresses for frictionless future checkouts.

### 🏪 For Sellers
- **Storefront Customization**: Upload store logos, set business descriptions, and manage verification status.
- **Inventory Management**: Full CRUD operations for products with Cloudinary image uploads, real-time stock tracking, and low-stock alerts.
- **Order Fulfillment**: View incoming orders, update statuses (Pending → Processing → Shipped → Delivered), and trigger automatic buyer notifications.
- **Analytics Dashboard**: Quick-view stats for active products, inventory value, and sales performance.

### 🛡️ Security & System Features
- **Email Verification**: 6-digit expiring codes for registration and password resets via Resend API.
- **Security Logging**: IP and geolocation tracking (`ipapi.co`) to detect and alert users of new device logins.
- **Activity Auditing**: Comprehensive logging of user actions and security events in the database.
- **Real-time Notifications**: In-app notification center for order updates, new reviews, and system alerts.

---

## 🏗️ Architecture & Tech Stack

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12+) for high-performance, asynchronous API development.
- **Database**: [PostgreSQL](https://www.postgresql.org/) for robust, relational data management.
- **ORM/Driver**: [`asyncpg`](https://magicstack.github.io/asyncpg/) for blazing-fast, non-blocking database connection pooling.
- **Authentication**: JWT (JSON Web Tokens) with `python-jose` and `passlib` (bcrypt) for secure password hashing.
- **Templating**: [Jinja2](https://jinja.palletsprojects.com/) for efficient server-side HTML rendering.

### Frontend
- **Core**: Semantic HTML5, modern CSS3 (CSS Variables, Flexbox, Grid), and Vanilla JavaScript (ES6+).
- **Styling**: Custom, mobile-first responsive design with smooth animations and a premium UI/UX.
- **Icons**: [Font Awesome 6](https://fontawesome.com/).

### Third-Party Integrations
| Service | Purpose | Why it was chosen |
| :--- | :--- | :--- |
| **Resend** | Transactional Emails | Modern API, high deliverability, and a generous free tier for verification/password reset emails. |
| **Cloudinary** | Image Hosting | Automatic image optimization, secure uploads, and reliable CDN delivery for product/store images. |
| **ipapi.co** | Geolocation | Lightweight, no-auth-required IP lookup to enhance security logging (detecting new login locations). |

---

## 📂 Project File Structure

```text
ecommerce_portfolio/
├── database/
│   └── schema.sql                 # Complete PostgreSQL schema with indexes and triggers
├── backend/
│   ├── main.py                    # FastAPI app, routes, and dependency injection
│   ├── database.py                # Asyncpg connection pool management
│   ├── utils.py                   # JWT, bcrypt, and async email utilities
│   ├── requirements.txt           # Python dependencies
│   └── .env                       # Environment variables (ignored in git)
└── frontend/
    ├── templates/                 # Jinja2 HTML templates (index, auth, dashboard, cart, checkout)
    └── static/
        ├── css/
        │   ├── style.css          # Global styles, landing page, and CSS variables
        │   ├── auth.css           # Authentication page styling
        │   ├── dashboard.css      # Premium dashboard, marketplace, and form styling
        │   └── cart.css           # Cart and checkout layout styling
        └── js/
            ├── main.js            # Landing page interactions
            ├── auth.js            # Login, register, and password reset logic
            ├── dashboard.js       # SPA-like dashboard routing, CRUD, and reviews
            ├── cart.js            # Cart state management and fee calculation
            └── checkout.js        # Checkout validation and mock payment processing
```

---

## 🗄️ Data Management Highlights

- **Connection Pooling**: `asyncpg` is configured with `min_size=5` and `max_size=20` to handle concurrent requests efficiently without exhausting database connections.
- **Atomic Transactions**: The checkout process uses `async with db.transaction():` to ensure that order creation, stock deduction, and cart clearing happen all at once. If any step fails, the entire transaction rolls back, preventing data corruption.
- **Soft Deletes**: Products are "archived" (`is_active = FALSE`) rather than hard-deleted to preserve historical order data and prevent broken foreign key references.
- **Automated Triggers**: A PostgreSQL trigger automatically recalculates and updates a seller's average rating whenever a new product review is submitted.

---

## 🛠️ Getting Started (Local Development)

### 1. Prerequisites
- Python 3.10+
- PostgreSQL 15+
- Git

### 2. Clone the Repository
```bash
git clone https://github.com/bigudom/shophub.git
cd shophub
```

### 3. Environment Setup
Create a virtual environment and install dependencies:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r backend/requirements.txt
```

### 4. Configure Environment Variables
Create a `backend/.env` file and populate it with your credentials:
```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/shophub
SECRET_KEY=your-super-secret-jwt-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Resend (Email)
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME=ShopHub

# Cloudinary (Images)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 5. Database Setup
```bash
# Create the database
createdb shophub

# Apply the schema
psql -d shophub -f database/schema.sql
```

### 6. Run the Application
```bash
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
Visit `http://127.0.0.1:8000` in your browser.

---

## 🌐 Deployment

This project is optimized for platforms like [Render](https://render.com/).
1. Connect your GitHub repository to Render.
2. Create a **Web Service**.
3. Set the **Build Command**: `pip install -r backend/requirements.txt`
4. Set the **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
5. Add all `.env` variables in the Render Environment Variables dashboard.
6. Attach a managed PostgreSQL database and update the `DATABASE_URL`.

*(Live Demo: [https://shophub-5slx.onrender.com/](https://shophub-5slx.onrender.com/))*

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request.

*Please ensure your code follows PEP 8 standards for Python and includes comments for complex logic.*

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 📬 Contact & Portfolio

Built with ❤️ by **Udom Blessing (BIGUDOM)**  

- 🌐 **Portfolio**: [bigudom.github.io/portoflio/](https://bigudom.github.io/portoflio/)
- 💼 **LinkedIn**: [linkedin.com/in/blessing-udom-8aa929397](https://www.linkedin.com/in/blessing-udom-8aa929397/)
- 📧 **Email**: [budom7774@gmail.com](mailto:budom7774@gmail.com)
- 🚀 **Live Project**: [shophub-5slx.onrender.com](https://shophub-5slx.onrender.com/)
```

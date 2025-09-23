# Fake Products Detector

FD is a Next.js web application that helps users identify counterfeit products by checking against xxxx database. Features user authentication, image upload, product scanning, and point-based usage system. 

## 🚀 Features

- **User Authentication** - Google OAuth with NextAuth.js
- **Product Scanning** - Upload up to 9 product images with camera support
- **Database Integration** - Real-time check against safety database
- **Points System** - Daily 5 points balance, 1 point per scan
- **Payment Integration** - Paystack & Flutterwave for points purchase
- **Modern UI** - Responsive design with Tailwind CSS & Shadcn/ui
- **Email Notifications** - SMTP-based alert system
- **Database** - PostgreSQL with Prisma ORM
- **Mobile App** - Andriod and IOS app

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 19, TypeScript
- **Styling**: Tailwind CSS v4, Shadcn/ui components
- **Database**: PostgreSQL, Prisma ORM
- **Authentication**: NextAuth.js, Google OAuth
- **Payments**: Paystack, Flutterwave
- **Email**: Nodemailer SMTP
- **Web Scraping**: Cheerio, Axios
- **OCR Processing**: Gemini, Claude, OpeaAi, Tesseract
- **Deployment**: Vercel, Andriod,and IOS

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL database
- Google OAuth credentials 
- Paystack/Flutterwave credentials
- SMTP email service

## 🚀 Getting Started  {}

1. **Clone the repository**
   Cone or build
2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Fill in all required environment variables.

4. **Set up database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

## 📊 Database Schema

The application uses Prisma ORM with the following main entities:
- **Users** - User accounts and points balance
- **ProductChecks** - Product scanning history
- **Payments** - Payment transactions
- **CheckResults** - Scan results and counterfeits found

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

## 🎨 UI Components

The app uses Shadcn/ui components with custom styling:
- Upload zones with drag & drop
- Result cards with links to full alerts article
- Balance display and points system UI
- Custom logos and animations

## 💳 Payment Integration

Supports both Paystack and Flutterwave payment gateways:
- Point purchase (100 naira = 1 point)
- Automatic balance updates
- Transaction verification
- Webhook handling

## 📧 Email System

SMTP-based notifications for:
- Welcome messages
- Payment confirmations
- Alert notifications

## 🔍 OCR & Image Processing

- Gemini, Claude, OpeaAi, and Tesseract for text extraction
- Batch number detection
- Product labeling recognition

## 📱 Mobile Responsive

Optimized for all screen sizes with camera support and touch-friendly interfaces.

## 🚀 Deployment

Built for Vercel deployment with:
- Edge runtime compatible
- Environment variable management
- PostgreSQL integration
- Static asset optimization
- Andriod and IOS

## 📝 License

This project is licensed under the MIT License.

## Emoji Favicons > eye in speech bubble

The emoji graphics are from the open source project Twemoji. The graphics are copyright 2020 Twitter, Inc and other contributors.

## 🤝 Contributing

1. Fork the project
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📞 Support

For support, email admin@sampidia.com or join our X (formerly twitter)  community.

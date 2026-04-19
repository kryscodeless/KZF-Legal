# KFZ-Legal
KZF Legal — an AI powered legal guidance platform
helping immigrants navigate the Australian immigration system.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Authentication:** Clerk
- **Database:** MongoDB (Mongoose)

## Getting Started

### Prerequisites

- Node.js v20 or higher
- npm v10 or higher
- MongoDB instance (local or Atlas)
- Clerk account (for auth keys)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd kzf-legal-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Verify the server is running:
   ```bash
   curl http://localhost:3000/api/health
   ```
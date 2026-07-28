import 'dotenv/config';
import express from 'express';
import jwt from 'jsonwebtoken';
import authRoutes from './routes/auth.js';

const app = express();
app.use(express.json());

app.use('/auth', authRoutes);

// Middleware that verifies the JWT sent in the Authorization Header
// Expecting "Authorization: Bearer <token>" format
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Uh oh! Seems like we are missing a header here... or maybe its malfunctioned?' });
    }

    try {
        const payload = jwt.verify(tokeb, process.env.JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        // Covers both expired and invalid signatures
        return res.status(401).json({ error: "Yeah... no. You got an expired OR invalid token" });
    }
}

// Protected route example, Only reachable with a valid token
app.get('/me', requireAuth, (req, res) => {
    res.json({ id: req.user.sub, email: req.user.email });
});

app.get('/healthz', (req, res) => res.json({ status: "Yep, I'm fine." }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Alright, server runs on http://localhost:${PORT} , have fun :)`)
});
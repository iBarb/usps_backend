import express from 'express';
import axios from 'axios';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();

// CORS restringido a tu dominio
app.use(cors({
  origin: 'https://besthomeoffer.ai',
  methods: ['POST'],
}));

app.use(express.json());

// Middleware para validar Referer
function verifyReferer(req, res, next) {
  const referer = req.get('Referer') || '';
  if (referer.startsWith('https://besthomeoffer.ai')) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied: invalid referer' });
}

// Rate limiters por endpoint
const addressLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 segundos
  max: 3,
  message: { error: 'Rate limit exceeded: wait 10 seconds' },
  standardHeaders: true,
  legacyHeaders: false,
});

const formLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 3,
  message: { error: 'Rate limit exceeded: wait 5 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const CLIENT_ID = process.env.USPS_CLIENT_ID;
const CLIENT_SECRET = process.env.USPS_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);

  const res = await axios.post('https://apis.usps.com/oauth2/v3/token', params);
  cachedToken = res.data.access_token;
  tokenExpiresAt = now + res.data.expires_in * 1000 - 10000;

  return cachedToken;
}

// Endpoint con rate limit de 10s
app.post('/validate-address', verifyReferer, addressLimiter, async (req, res) => {
  try {
    const { streetAddress, city, state, ZIPCode, secondaryAddress } = req.body;
    const token = await getAccessToken();

    const response = await axios.get('https://apis.usps.com/addresses/v3/address', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      params: {
        streetAddress,
        city,
        state,
        ZIPCode,
        secondaryAddress,
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Error validating address' });
  }
});

// Endpoint con rate limit de 5 minutos
app.post('/send-form', verifyReferer, formLimiter, async (req, res) => {
  try {
    const data = req.body;

    const response = await axios.post(
      'https://script.google.com/macros/s/AKfycby9PFTV7XMpt8eUU6dZ0U7Ppnlga_3Znswt2kQl70lm26FIisS6Ot-1CS45TcDwMgaJ/exec',
      new URLSearchParams(data),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Google Script error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error sending data to Google Script' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

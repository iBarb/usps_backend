import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

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
  tokenExpiresAt = now + res.data.expires_in * 1000 - 10000; // Buffer de 10s

  return cachedToken;
}

app.post('/validate-address', async (req, res) => {
  try {
    const { streetAddress, city, state, ZIPCode, secondaryAddress } = req.body;
    const token = await getAccessToken();

    const response = await axios.get('https://apis.usps.com/addresses/v3/address', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      },
      params: {
        streetAddress,
        city,
        state,
        ZIPCode,
        secondaryAddress
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Error validating address' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
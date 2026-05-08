const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Endpoint de test minimal
app.get('/api/v1/trust', (req, res) => {
  const target = req.query.target;
  if (!target) return res.status(400).json({ error: 'Missing target' });
  const score = Math.floor(Math.random() * 100);
  const grade = score >= 80 ? 'A' : score >= 50 ? 'B' : 'C';
  res.json({ target, score, grade });
});

app.listen(port, () => console.log(`LOGEN API ready on port ${port}`)); 
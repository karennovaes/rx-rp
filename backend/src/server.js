import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Inicializa as variáveis de ambiente (onde ficarão as senhas)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações de segurança e formato de dados
app.use(cors()); // Permite que o seu site React se conecte
app.use(express.json()); // Diz pro servidor entender dados no formato JSON

// Rota de Teste ("Hello World")
app.get('/api/status', (req, res) => {
  res.json({ 
    mensagem: "Servidor da RX online e operante! 🛡️",
    status: "ok"
  });
});

// Liga o servidor e fica escutando a porta
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
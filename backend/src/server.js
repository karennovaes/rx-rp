import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Importação das rotas
import membroRoutes from './routes/membros.js'; // 
import acaoRoutes from './routes/acoes.js';
import metasRoutes from './routes/metas.js';


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



//  Conectando as rotas de membros na URL principal
app.use('/api/membros', membroRoutes);
app.use('/api/acoes', acaoRoutes); // <-- Adicionado aqui!
app.use('/api/metas', metasRoutes);


// Liga o servidor e fica escutando a porta
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
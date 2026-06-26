import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient(); // Inicia a conexão com o banco

// 1. Rota para CRIAR um novo membro (POST)
router.post('/', async (req, res) => {
  try {
    // Pega as informações que o Frontend vai enviar
    const { nome, passaporte, cargo } = req.body;

    // Manda o Prisma salvar no banco de dados
    const novoMembro = await prisma.membro.create({
      data: {
        nome,
        passaporte,
        cargo
      }
    });

    // Retorna o membro criado com status 201 (Created)
    res.status(201).json(novoMembro);
  } catch (error) {
    console.error(error);
    res.status(400).json({ erro: "Erro ao cadastrar membro." });
  }
});

// 2. Rota para LISTAR todos os membros (GET)
router.get('/', async (req, res) => {
  try {
    // Manda o Prisma buscar todos os membros
    const membros = await prisma.membro.findMany({
      orderBy: { criadoEm: 'desc' } // Ordena dos mais novos para os mais antigos
    });
    
    res.json(membros);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar membros." });
  }
});

export default router;
import express from 'express';
import prisma from '../database.js';

const router = express.Router();


// 1. Rota para CRIAR um novo membro (POST)
router.post('/', async (req, res) => {
  try {
    const { nome, passaporte, cargo } = req.body;

    const novoMembro = await prisma.membro.create({
      data: { nome, passaporte, cargo }
    });

    res.status(201).json(novoMembro);
  } catch (error) {
    console.error("ERRO REAL AQUI Ó:", error);
    res.status(400).json({ erro: "Erro ao cadastrar membro. O passaporte já pode estar em uso." });
  }
});

// 2. Rota para LISTAR todos os membros (GET)
router.get('/', async (req, res) => {
  try {
    const membros = await prisma.membro.findMany({
      orderBy: { criadoEm: 'desc' }
    });
    
    res.json(membros);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar membros." });
  }
});

// 3. Rota para EDITAR um membro (PUT)
router.put('/:id', async (req, res) => {
  try {
    // Pega o ID que vem na URL (ex: /api/membros/1)
    const { id } = req.params; 
    // Pega os novos dados que vieram no corpo da requisição
    const { nome, passaporte, cargo } = req.body;

    const membroAtualizado = await prisma.membro.update({
      where: { id: Number(id) }, // Converte o ID da URL para Número
      data: { nome, passaporte, cargo }
    });

    res.json(membroAtualizado);
  } catch (error) {
    console.error(error);
    res.status(400).json({ erro: "Erro ao editar membro. Verifique se o ID existe." });
  }
});

// 4. Rota para EXCLUIR um membro (DELETE)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.membro.delete({
      where: { id: Number(id) }
    });

    res.json({ mensagem: "Membro excluído com sucesso!" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ erro: "Erro ao excluir membro. Verifique se o ID existe." });
  }
});

// 5. Rota para BUSCAR apenas 1 membro específico (GET por ID)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // findUnique é o comando do Prisma para buscar uma única linha pela chave primária
    const membro = await prisma.membro.findUnique({
      where: { id: Number(id) }
    });

    // Se o banco não achar ninguém com esse ID, retornamos erro 404 (Not Found)
    if (!membro) {
      return res.status(404).json({ erro: "Membro não encontrado." });
    }

    res.json(membro);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar o membro." });
  }
});



export default router;
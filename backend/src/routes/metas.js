import express from 'express';
import prisma from '../database.js';

const router = express.Router();

// 1. DEFINIR OU ATUALIZAR METAS PARA UM GRUPO (POST) -> Usado por Líderes
router.post('/definir', async (req, res) => {
  try {
    const { grupoAlvo, metaAcoes, metaDinheiroSujo, metaItensFarme } = req.body; // grupoAlvo: "ELITE" ou "MEMBRO"

    const metaAtualizada = await prisma.meta.upsert({
      where: { grupoAlvo: grupoAlvo.toUpperCase() },
      update: {
        metaAcoes: Number(metaAcoes || 0),
        metaDinheiroSujo: Number(metaDinheiroSujo || 0),
        metaItensFarme: Number(metaItensFarme || 0)
      },
      create: {
        grupoAlvo: grupoAlvo.toUpperCase(),
        metaAcoes: Number(metaAcoes || 0),
        metaDinheiroSujo: Number(metaDinheiroSujo || 0),
        metaItensFarme: Number(metaItensFarme || 0)
      }
    });

    res.json({ mensagem: `Meta do grupo ${grupoAlvo} configurada!`, dados: metaAtualizada });
  } catch (error) {
    res.status(400).json({ erro: "Erro ao definir parâmetros da meta." });
  }
});

// 2. ADICIONAR FARME MANUALMENTE (PATCH) -> Quando o membro guarda itens de farme no baú
router.patch('/membro/:id/farme', async (req, res) => {
  try {
    const { quantidade } = req.body;
    const membroAtualizado = await prisma.membro.update({
      where: { id: Number(req.params.id) },
      data: { itensFarmados: { increment: Number(quantidade) } }
    });
    res.json({ mensagem: "Farme contabilizado com sucesso!", itensFarmadosTotal: membroAtualizado.itensFarmados });
  } catch (error) {
    res.status(400).json({ erro: "Erro ao registrar farme." });
  }
});

// 3. PAINEL DE METAS E QUADRO DE DESEMPENHO GERAL (GET)
router.get('/painel', async (req, res) => {
  try {
    const metas = await prisma.meta.findMany();
    const membros = await prisma.membro.findMany();

    // Mapeia cada membro calculando a porcentagem de conclusão da meta dele
    const quadroDesempenho = membros.map(membro => {
      // Identifica o grupo de meta dele com base no cargo
      const chaveGrupo = membro.cargo.toUpperCase() === "ELITE" ? "ELITE" : "MEMBRO";
      const metaDoGrupo = metas.find(m => m.grupoAlvo === chaveGrupo) || { metaAcoes: 1, metaDinheiroSujo: 1, metaItensFarme: 1 };

      const totalAcoesParticipadas = membro.acoesGanhas + membro.acoesPerdidas;
      
      // Calcula as taxas de entrega em %
      const pctAcoes = Math.min((totalAcoesParticipadas / (metaDoGrupo.metaAcoes || 1)) * 100, 100);
      const pctDinheiro = Math.min((membro.totalDinheiroSujoArrecadado / (metaDoGrupo.metaDinheiroSujo || 1)) * 100, 100);
      const pctFarme = Math.min((membro.itensFarmados / (metaDoGrupo.metaItensFarme || 1)) * 100, 100);

      // Média geral batida
      const progressoGeral = (pctAcoes + pctDinheiro + pctFarme) / 3;

      return {
        id: membro.id,
        nome: membro.nome,
        passaporte: membro.passaporte,
        cargo: membro.cargo,
        estatisticas: {
          vitorias: membro.acoesGanhas,
          derrotas: membro.acoesPerdidas,
          winRate: totalAcoesParticipadas > 0 ? `${((membro.acoesGanhas / totalAcoesParticipadas) * 100).toFixed(1)}%` : "0%"
        },
        metasAtuais: {
          acoes: `${totalAcoesParticipadas}/${metaDoGrupo.metaAcoes} (${pctAcoes.toFixed(0)}%)`,
          dinheiroSujo: `R$ ${membro.totalDinheiroSujoArrecadado}/R$ ${metaDoGrupo.metaDinheiroSujo} (${pctDinheiro.toFixed(0)}%)`,
          farme: `${membro.itensFarmados}/${metaDoGrupo.metaItensFarme} (${pctFarme.toFixed(0)}%)`,
          metaBatida: progressoGeral >= 100
        }
      };
    });

    res.json({
      configuracaoMetas: metas,
      rankingDesempenho: quadroDesempenho.sort((a, b) => b.estatisticas.vitorias - a.estatisticas.vitorias) // ordena por quem tem mais vitória
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao gerar painel de controle." });
  }
});

export default router;
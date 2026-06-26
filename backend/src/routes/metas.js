import express from 'express';
import prisma from '../database.js';

const router = express.Router();

// 1. DEFINIR METAS POR CARGO E SEUS ITENS MULTIPLOS (POST)
router.post('/definir', async (req, res) => {
  try {
    const { 
      cargoAlvo, metaAcoes, metaDinheiroSujo, itensFarme, // itensFarme deve ser um array: [{"nomeItem": "Gatilho", "quantidade": 20}]
      pctLavagem, pctFaccao, pctMembros 
    } = req.body; 

    const cargoFormatado = cargoAlvo.toUpperCase();

    // 1. Cria ou atualiza a meta base do cargo
    const metaBase = await prisma.meta.upsert({
      where: { cargoAlvo: cargoFormatado },
      update: {
        metaAcoes: metaAcoes ? Number(metaAcoes) : undefined,
        metaDinheiroSujo: metaDinheiroSujo ? Number(metaDinheiroSujo) : undefined,
        pctLavagem: pctLavagem ? Number(pctLavagem) : undefined,
        pctFaccao: pctFaccao ? Number(pctFaccao) : undefined,
        pctMembros: pctMembros ? Number(pctMembros) : undefined
      },
      create: {
        cargoAlvo: cargoFormatado,
        metaAcoes: Number(metaAcoes || 0),
        metaDinheiroSujo: Number(metaDinheiroSujo || 0),
        pctLavagem: Number(pctLavagem || 30),
        pctFaccao: Number(pctFaccao || 60),
        pctMembros: Number(pctMembros || 40)
      }
    });

    // 2. Se foram enviados itens de farme, limpa os antigos e adiciona a nova lista técnica
    if (itensFarme && Array.isArray(itensFarme)) {
      await prisma.metaItem.deleteMany({ where: { metaId: metaBase.id } });
      
      for (const item of itensFarme) {
        await prisma.metaItem.create({
          data: {
            metaId: metaBase.id,
            nomeItem: item.nomeItem,
            quantidade: Number(item.quantidade)
          }
        });
      }
    }

    res.json({ mensagem: `Metas do cargo ${cargoFormatado} definidas com sucesso!` });
  } catch (error) {
    console.error(error);
    res.status(400).json({ erro: "Erro ao definir parâmetros das metas." });
  }
});

// 2. ADICIONAR ENTREGA DE FARME DO MEMBRO (PATCH) - Trata múltiplos itens via JSON
router.patch('/membro/:id/farme', async (req, res) => {
  try {
    const { nomeItem, quantidade } = req.body;
    const membroId = Number(req.params.id);

    const membro = await prisma.membro.findUnique({ where: { id: membroId } });
    if (!membro) return res.status(404).json({ erro: "Membro não encontrado." });

    // Modifica o JSON de entregas atuais
    let itensAtuais = typeof membro.itensFarmadosJson === 'string' 
      ? JSON.parse(membro.itensFarmadosJson) 
      : (membro.itensFarmadosJson || {});

    itensAtuais[nomeItem] = (itensAtuais[nomeItem] || 0) + Number(quantidade);

    const membroAtualizado = await prisma.membro.update({
      where: { id: membroId },
      data: { itensFarmadosJson: itensAtuais }
    });

    res.json({ mensagem: "Entrega registrada!", inventarioSemanal: membroAtualizado.itensFarmadosJson });
  } catch (error) {
    res.status(400).json({ erro: "Erro ao registrar farme." });
  }
});

// 3. QUADRO DE METAS INTELIGENTE POR CARGO (GET)
router.get('/painel', async (req, res) => {
  try {
    const metas = await prisma.meta.findMany({ include: { itensExigidos: true } });
    const membros = await prisma.membro.findMany();

    const rankingDesempenho = membros.map(membro => {
      const cargoUpper = membro.cargo.toUpperCase();
      const metaDoCargo = metas.find(m => m.cargoAlvo === cargoUpper);

      const totalAcoes = membro.acoesGanhas + membro.acoesPerdidas;
      let resumoMetas = {};
      let pctTotal = 0;
      let checagens = 0;

      // --- LOGICA DE REQUISITOS POR CARGO ---
      
      // 1. Vapor e Membro -> Focados apenas em Itens de Farme
      if (["VAPOR", "MEMBRO"].includes(cargoUpper) && metaDoCargo) {
        let progressoItens = [];
        let totalPctItens = 0;
        const itensEntregues = typeof membro.itensFarmadosJson === 'string' ? JSON.parse(membro.itensFarmadosJson) : (membro.itensFarmadosJson || {});

        if (metaDoCargo.itensExigidos.length > 0) {
          metaDoCargo.itensExigidos.forEach(itemMeta => {
            const entregue = itensEntregues[itemMeta.nomeItem] || 0;
            const pct = Math.min((entregue / itemMeta.quantidade) * 100, 100);
            totalPctItens += pct;
            progressoItens.push(`${itemMeta.nomeItem}: ${entregue}/${itemMeta.quantidade} (${pct.toFixed(0)}%)`);
          });
          pctTotal = totalPctItens / metaDoCargo.itensExigidos.length;
        } else {
          pctTotal = 100; // Se não configurou item, considera batido
        }
        resumoMetas.farmeExigido = progressoItens;
        checagens = 1;
      }

      // 2. P1 -> Focado puramente em Dinheiro Sujo
      else if (cargoUpper === "P1" && metaDoCargo) {
        pctTotal = Math.min((membro.totalDinheiroSujoArrecadado / (metaDoCargo.metaDinheiroSujo || 1)) * 100, 100);
        resumoMetas.dinheiroSujo = `R$ ${membro.totalDinheiroSujoArrecadado}/R$ ${metaDoCargo.metaDinheiroSujo} (${pctTotal.toFixed(0)}%)`;
        checagens = 1;
      }

      // 3. Elite -> Ações OU Dinheiro Sujo (O que ele bater primeiro ou média, vamos calcular o foco definido)
      else if (cargoUpper === "ELITE" && metaDoCargo) {
        const pctAcoes = Math.min((totalAcoes / (metaDoCargo.metaAcoes || 1)) * 100, 100);
        const pctGrana = Math.min((membro.totalDinheiroSujoArrecadado / (metaDoCargo.metaDinheiroSujo || 1)) * 100, 100);
        
        // No caso do Elite, como você mencionou "Ações ou Dinheiro Sujo", daremos o maior progresso alcançado
        pctTotal = Math.max(pctAcoes, pctGrana);
        resumoMetas.acoes = `${totalAcoes}/${metaDoCargo.metaAcoes} (${pctAcoes.toFixed(0)}%)`;
        resumoMetas.dinheiroSujo = `R$ ${membro.totalDinheiroSujoArrecadado}/R$ ${metaDoCargo.metaDinheiroSujo} (${pctGrana.toFixed(0)}%)`;
        checagens = 1;
      }

      // 4. Líder e Gerente -> Ações Gerais/Administração
      else {
        pctTotal = metaDoCargo && metaDoCargo.metaAcoes > 0 ? Math.min((totalAcoes / metaDoCargo.metaAcoes) * 100, 100) : 100;
        resumoMetas.acoesComando = `${totalAcoes}/${metaDoCargo?.metaAcoes || 0}`;
        checagens = 1;
      }

      return {
        id: membro.id,
        nome: membro.nome,
        cargo: membro.cargo,
        passaporte: membro.passaporte,
        vitoriasDerrotas: `${membro.acoesGanhas}V / ${membro.acoesPerdidas}D`,
        progressoDaMeta: `${pctTotal.toFixed(0)}%`,
        metaConcluida: pctTotal >= 100,
        detalhes: resumoMetas
      };
    });

    res.json({ rankingSemanal: rankingDesempenho });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao renderizar painel de metas por cargo." });
  }
});

// 4. RESET SEMANAL
router.post('/reset-semanal', async (req, res) => {
  try {
    await prisma.membro.updateMany({
      data: {
        acoesGanhas: 0,
        acoesPerdidas: 0,
        totalDinheiroSujoArrecadado: 0,
        itensFarmadosJson: "{}"
      }
    });
    res.json({ mensagem: "🔄 Quadro semanal resetado com sucesso!" });
  } catch (error) {
    res.status(400).json({ erro: "Erro ao resetar semana." });
  }
});

export default router;
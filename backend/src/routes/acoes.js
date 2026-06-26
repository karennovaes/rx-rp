import express from 'express';
import prisma from '../database.js';

const router = express.Router();

// 1. CRIAR UMA NOVA AÇÃO (POST)
router.post('/', async (req, res) => {
  try {
    const { 
      titulo, dataHora, tipoAcao, porteAcao, 
      vagasTotais, comando, usaRefens, qtdRefens, 
      qtdCarros, vagasPorCarro 
    } = req.body;

    let vagasCalculadas = vagasTotais;
    if (tipoAcao === 'FUGA' && qtdCarros && vagasPorCarro) {
      vagasCalculadas = qtdCarros * vagasPorCarro;
    }

    const novaAcao = await prisma.acao.create({
      data: {
        titulo,
        dataHora: new Date(dataHora),
        tipoAcao,
        porteAcao,
        vagasTotais: Number(vagasCalculadas),
        comando,
        usaRefens: !!usaRefens,
        qtdRefens: Number(qtdRefens || 0),
        qtdCarros: qtdCarros ? Number(qtdCarros) : null,
        vagasPorCarro: vagasPorCarro ? Number(vagasPorCarro) : null,
        status: "AGENDADA" // Toda ação nasce agendada
      }
    });

    res.status(201).json(novaAcao);
  } catch (error) {
    console.error(error);
    res.status(400).json({ erro: "Erro ao criar escalação de ação." });
  }
});

// 2. LISTAR TODAS AS AÇÕES (GET)
router.get('/', async (req, res) => {
  try {
    const acoes = await prisma.acao.findMany({
      include: {
        participantes: {
          include: { membro: true }
        }
      },
      orderBy: { dataHora: 'asc' }
    });

    const acoesFormatadas = acoes.map(acao => {
      const dataAcao = new Date(acao.dataHora);
      const dataFormacao = new Date(dataAcao.getTime() - 45 * 60000);
      
      let armamentoSugerido = "Nenhum especificado";
      if (acao.tipoAcao === 'TIRO') {
        if (acao.porteAcao === 'Pequena') armamentoSugerido = "Pistolas (Glock / FiveSeven) + Colete Leve";
        else if (acao.porteAcao === 'Média') armamentoSugerido = "Submetralhadoras (MP5 / Uzi) + Colete Médio";
        else if (acao.porteAcao === 'Grande') armamentoSugerido = "Fuzis (M4 / AK47) + Gás + Colete Pesado";
        else if (acao.porteAcao === 'Evento') armamentoSugerido = "Armamento liberado pelo Comando da Ação";
      } else {
        armamentoSugerido = "Armamento velado para fuga (Pistola básica)";
      }

      return {
        ...acao,
        horarioFormacao: dataFormacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        avisoAutomatico: `⚠️ FORMAÇÃO OBRIGATÓRIA ÀS ${dataFormacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}!`,
        armamentoNecessario: armamentoSugerido
      };
    });

    res.json(acoesFormatadas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar ações." });
  }
});

// 3. SE CANDIDATAR A UMA VAGA (POST)
router.post('/:id/inscrever', async (req, res) => {
  try {
    const acaoId = Number(req.params.id);
    const { membroId, funcao } = req.body;

    const acao = await prisma.acao.findUnique({
      where: { id: acaoId },
      include: { participantes: true }
    });

    if (!acao) return res.status(404).json({ erro: "Ação não encontrada." });
    if (acao.status !== "AGENDADA") return res.status(400).json({ erro: "Inscrições fechadas. A ação já iniciou ou foi finalizada." });

    const qtdPrincipais = acao.participantes.filter(p => p.tipoVaga === 'PRINCIPAL').length;
    const tipoVaga = qtdPrincipais < acao.vagasTotais ? 'PRINCIPAL' : 'RESERVA';

    const novaInscricao = await prisma.participanteAcao.create({
      data: {
        acaoId,
        membroId: Number(membroId),
        tipoVaga,
        funcao: funcao || "Nenhuma"
      },
      include: { membro: true }
    });

    res.status(201).json({ mensagem: `Inscrito como ${tipoVaga}!`, dados: novaInscricao });
  } catch (error) {
    res.status(400).json({ erro: "Membro já inscrito ou dados inválidos." });
  }
});

// 4. ATUALIZAR STATUS OU MARCAR CHECK-IN (PATCH)
router.patch('/:id/participante', async (req, res) => {
  try {
    const acaoId = Number(req.params.id);
    const { membroId, checkIn, funcao } = req.body;

    const participanteAtualizado = await prisma.participanteAcao.update({
      where: { acaoId_membroId: { acaoId, membroId: Number(membroId) } },
      data: {
        ...(checkIn !== undefined && { checkIn }),
        ...(funcao && { funcao })
      }
    });

    res.json({ mensagem: "Presença/Função atualizada!", dados: participanteAtualizado });
  } catch (error) {
    res.status(400).json({ erro: "Erro ao atualizar participante." });
  }
});

// 5. MUDAR STATUS DA AÇÃO (PATCH) -> Ex: Mudar para "FORMANDO"
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const acaoAtualizada = await prisma.acao.update({
      where: { id: Number(req.params.id) },
      data: { status: status.toUpperCase() }
    });
    res.json(acaoAtualizada);
  } catch (error) {
    res.status(400).json({ erro: "Erro ao atualizar status da ação." });
  }
});

// 6. FECHAR AÇÃO, CALCULAR FINANÇAS E ATUALIZAR METAS/HISTÓRICO DO MEMBRO (POST)
router.post('/:id/fechar', async (req, res) => {
  try {
    const acaoId = Number(req.params.id);
    const { resultado, valorSujoTotal } = req.body; // resultado: "GANHA", "PERDIDA", "CANCELADA"

    const acao = await prisma.acao.findUnique({
      where: { id: acaoId },
      include: { participantes: true }
    });

    if (!acao) return res.status(404).json({ erro: "Ação não encontrada." });
    if (acao.status === "CONCLUIDA") return res.status(400).json({ erro: "Esta ação já foi fechada anteriormente." });

    let dadosFechamento = {
      status: "CONCLUIDA",
      resultado: resultado.toUpperCase()
    };

    // Descobre os membros que participaram de verdade (Vaga principal + Presença confirmada)
    const participantesValidos = acao.participantes.filter(p => p.tipoVaga === "PRINCIPAL" && p.checkIn === true);

    let porMembro = 0;
    let faccao = 0;
    let aposLavagem = 0;
    const bruto = Number(valorSujoTotal || 0);

    if (resultado.toUpperCase() === "GANHA") {
      aposLavagem = bruto * 0.70; // Desconto dos 30% da lavagem
      faccao = aposLavagem * 0.60; // 60% para o Baú
      const membrosTotal = aposLavagem * 0.40; // 40% para os participantes
      
      const qtdMembros = participantesValidos.length || 1;
      porMembro = membrosTotal / qtdMembros;

      dadosFechamento = {
        ...dadosFechamento,
        valorSujoTotal: bruto,
        valorAposLavagem: aposLavagem,
        lucroFaccao: faccao,
        lucroMembros: membrosTotal,
        lucroPorMembro: porMembro
      };
    }

    // --- ENGENHARIA DE HISTÓRICO AUTOMÁTICO ---
    // Fazemos um loop atualizando o perfil de cada membro que lutou nessa ação
    for (const participante of participantesValidos) {
      await prisma.membro.update({
        where: { id: participante.membroId },
        data: {
          // Incrementa +1 ação ganha ou perdida usando o operador increment do Prisma
          acoesGanhas: resultado.toUpperCase() === "GANHA" ? { increment: 1 } : undefined,
          acoesPerdidas: resultado.toUpperCase() === "PERDIDA" ? { increment: 1 } : undefined,
          // Acumula o dinheiro sujo bruto que esse membro ajudou a trazer para o progresso da meta
          totalDinheiroSujoArrecadado: resultado.toUpperCase() === "GANHA" ? { increment: bruto } : undefined
        }
      });
    }

    const acaoFinalizada = await prisma.acao.update({
      where: { id: acaoId },
      data: dadosFechamento
    });

    res.json({
      mensagem: `Ação finalizada com sucesso! O histórico de desempenho de ${participantesValidos.length} membros foi atualizado automaticamente.`,
      resumoFinanceiro: resultado.toUpperCase() === "GANHA" ? {
        totalDinheiroSujo: bruto,
        guardarNoBauDaFaccao60: faccao,
        pagamentoPorCadaMembroPresente: porMembro
      } : "Ação fechada sem lucros financeiros. Histórico de derrotas atualizado."
    });

  } catch (error) {
    console.error("Erro ao fechar ação e atualizar metas:", error);
    res.status(400).json({ erro: "Erro ao fechar contabilidade e metas da ação." });
  }
});

export default router;
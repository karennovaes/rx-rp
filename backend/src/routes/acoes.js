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

// 6. FECHAR AÇÃO UTILIZANDO AS PORCENTAGENS CONFIGURÁVEIS DA GERÊNCIA (POST)
router.post('/:id/fechar', async (req, res) => {
  try {
    const acaoId = Number(req.params.id);
    const { resultado, valorSujoTotal } = req.body; 

    const acao = await prisma.acao.findUnique({
      where: { id: acaoId },
      include: { participantes: true }
    });

    if (!acao) return res.status(404).json({ erro: "Ação não encontrada." });
    if (acao.status === "CONCLUIDA") return res.status(400).json({ erro: "Esta ação já foi fechada." });

    let dadosFechamento = {
      status: "CONCLUIDA",
      resultado: resultado.toUpperCase()
    };

    const participantesValidos = acao.participantes.filter(p => p.tipoVaga === "PRINCIPAL" && p.checkIn === true);

    if (resultado.toUpperCase() === "GANHA") {
      const bruto = Number(valorSujoTotal || 0);

      // 1. BUSCA AS CONFIGURAÇÕES DE PORCENTAGEM DA GERÊNCIA
      // Como as taxas são gerais, buscamos a configuração do grupo "MEMBRO" como padrão do sistema
      let configuracaoJanela = await prisma.meta.findUnique({ where: { grupoAlvo: "MEMBRO" } });
      
      // Caso a gerência ainda não tenha configurado nada, usamos o padrão de segurança
      const taxas = configuracaoJanela || { pctLavagem: 30, pctFaccao: 60, pctMembros: 40 };

      // 2. CÁLCULO DINÂMICO BASEADO NO BANCO DE DADOS
      const fatorLavagem = (100 - taxas.pctLavagem) / 100; // Ex: (100 - 30) / 100 = 0.70
      const fatorFaccao = taxas.pctFaccao / 100;          // Ex: 60 / 100 = 0.60
      const fatorMembros = taxas.pctMembros / 100;        // Ex: 40 / 100 = 0.40

      const aposLavagem = bruto * fatorLavagem; 
      const faccao = aposLavagem * fatorFaccao; 
      const membrosTotal = aposLavagem * fatorMembros; 
      
      const qtdMembros = participantesValidos.length || 1;
      const porMembro = membrosTotal / qtdMembros;

      dadosFechamento = {
        ...dadosFechamento,
        valorSujoTotal: bruto,
        pctLavagemAplicada: taxas.pctLavagem,
        valorAposLavagem: aposLavagem,
        lucroFaccao: faccao,
        lucroMembros: membrosTotal,
        lucroPorMembro: porMembro
      };

      // --- ATUALIZAÇÃO DO HISTÓRICO DOS PARTICIPANTES ---
      for (const participante of participantesValidos) {
        await prisma.membro.update({
          where: { id: participante.membroId },
          data: {
            acoesGanhas: { increment: 1 },
            totalDinheiroSujoArrecadado: { increment: bruto }
          }
        });
      }
    } else if (resultado.toUpperCase() === "PERDIDA") {
      for (const participante of participantesValidos) {
        await prisma.membro.update({
          where: { id: participante.membroId },
          data: { acoesPerdidas: { increment: 1 } }
        });
      }
    }

    const acaoFinalizada = await prisma.acao.update({
      where: { id: acaoId },
      data: dadosFechamento
    });

    res.json({
      mensagem: `Ação finalizada com as taxas configuradas pela gerência!`,
      taxasAplicadas: acaoFinalizada.pctLavagemAplicada ? {
        lavagemRetida: `${acaoFinalizada.pctLavagemAplicada}%`,
        divisaoBauFaccao: `${100 - acaoFinalizada.pctLavagemAplicada}% limpo -> de onde a faccao retém sua parte.`
      } : "Nenhuma taxa aplicada.",
      resumoFinanceiro: resultado.toUpperCase() === "GANHA" ? {
        totalBrutoSujo: dadosFechamento.valorSujoTotal,
        limpoAposLavagem: dadosFechamento.valorAposLavagem,
        enviadoAoBauFaccao: dadosFechamento.lucroFaccao,
        divididoEntreMembros: dadosFechamento.lucroMembros,
        recebidoPorCadaMembroPresente: dadosFechamento.lucroPorMembro
      } : "Ação fechada sem movimentação financeira."
    });

  } catch (error) {
    console.error(error);
    res.status(400).json({ erro: "Erro ao processar fechamento com taxas dinâmicas." });
  }
});

export default router;
import express from 'express';
import prisma from '../database.js';

const router = express.Router();

// 1. CRIAR UMA NOVA AÇÃO (POST) - Usado por Líderes/Gerentes
router.post('/', async (req, res) => {
  try {
    const { 
      titulo, dataHora, tipoAcao, porteAcao, 
      vagasTotais, comando, usaRefens, qtdRefens, 
      qtdCarros, vagasPorCarro 
    } = req.body;

    // Se for Fuga, calculamos as vagas totais multiplicando carros x vagas por carro
    let vagasCalculadas = vagasTotais;
    if (tipoAcao === 'FUGA' && qtdCarros && vagasPorCarro) {
      vagasCalculadas = qtdCarros * vagasPorCarro;
    }

    const novaAcao = await prisma.acao.create({
      data: {
        titulo,
        dataHora: new Date(dataHora), // Garante o formato de data do JS
        tipoAcao, // "TIRO" ou "FUGA"
        porteAcao,
        vagasTotais: Number(vagasCalculadas),
        comando,
        usaRefens: !!usaRefens,
        qtdRefens: Number(qtdRefens || 0),
        qtdCarros: qtdCarros ? Number(qtdCarros) : null,
        vagasPorCarro: vagasPorCarro ? Number(vagasPorCarro) : null
      }
    });

    res.status(201).json(novaAcao);
  } catch (error) {
    console.error(error);
    res.status(400).json({ erro: "Erro ao criar escalação de ação." });
  }
});

// 2. LISTAR TODAS AS AÇÕES COM AVISO AUTOMÁTICO DE FORMAÇÃO (GET)
router.get('/', async (req, res) => {
  try {
    const acoes = await prisma.acao.findMany({
      include: {
        participantes: {
          include: { membro: true } // Já traz os dados dos membros inscritos junto
        }
      },
      orderBy: { dataHora: 'asc' }
    });

    // Mapeia as ações para injetar as regras automáticas de armamento e horário
    const acoesFormatadas = acoes.map(acao => {
      const dataAcao = new Date(acao.dataHora);
      // Calcula 45 minutos antes para a formação
      const dataFormacao = new Date(dataAcao.getTime() - 45 * 60000);
      
      // Regra de Armamento Automático baseado no Tipo/Porte da ação de Tiro
      let armamentoSugerido = "Nenhum especificado";
      if (acao.tipoAcao === 'TIRO') {
        if (acao.porteAcao === 'Pequena') armamentoSugerido = "Pistolas (Glock/FiveSeven) + Colete Leve";
        else if (acao.porteAcao === 'Média') armamentoSugerido = "Submetralhadoras (MP5/Uzi) + Colete Médio";
        else if (acao.porteAcao === 'Grande') armamentoSugerido = "Fuzis (M4/AK47) + Gás + Colete Pesado";
        else if (acao.porteAcao === 'Evento') armamentoSugerido = "Armamento liberado pelo Comando da Ação";
      } else {
        armamentoSugerido = "Armamento velado para fuga (Pistola básica)";
      }

      return {
        ...acao,
        horarioFormacao: dataFormacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        avisoAutomatico: `⚠️ FORMAÇÃO OBRIGATÓRIA ÀS ${dataFormacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (45 minutos antes)!`,
        armamentoNecessario: armamentoSugerido
      };
    });

    res.json(acoesFormatadas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar ações." });
  }
});

// 3. CANDIDATAR-SE A UMA AÇÃO (POST) - Usado pelos Membros
router.post('/:id/inscrever', async (req, res) => {
  try {
    const acaoId = Number(req.params.id);
    const { membroId } = req.body;

    // 1. Busca a ação para ver quantas vagas principais ela tem
    const acao = await prisma.acao.findUnique({
      where: { id: acaoId },
      include: { participantes: true }
    });

    if (!acao) return res.status(404).json({ erro: "Ação não encontrada." });

    // 2. Conta quantos já estão na vaga "PRINCIPAL"
    const qtdPrincipais = acao.participantes.filter(p => p.tipoVaga === 'PRINCIPAL').length;

    // 3. Se ainda houver vagas, entra como PRINCIPAL. Se não, vai automático para RESERVA.
    const tipoVaga = qtdPrincipais < acao.vagasTotais ? 'PRINCIPAL' : 'RESERVA';

    const novaInscricao = await prisma.participanteAcao.create({
      data: {
        acaoId,
        membroId: Number(membroId),
        tipoVaga
      },
      include: { membro: true }
    });

    res.status(201).json({
      mensagem: `Inscrição realizada com sucesso como ${tipoVaga}!`,
      dados: novaInscricao
    });

  } catch (error) {
    console.error(error);
    res.status(400).json({ erro: "Você já está inscrito nesta ação ou o membro informado é inválido." });
  }
});

export default router;
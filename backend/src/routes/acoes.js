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

    // Se for Fuga, o total de vagas é calculado multiplicando carros x vagas por carro
    let vagasCalculadas = vagasTotais;
    if (tipoAcao === 'FUGA' && qtdCarros && vagasPorCarro) {
      vagasCalculadas = qtdCarros * vagasPorCarro;
    }

    const novaAcao = await prisma.acao.create({
      data: {
        titulo,
        dataHora: new Date(dataHora), // Converte a string enviada para o formato Date do JS
        tipoAcao,                     // "TIRO" ou "FUGA"
        porteAcao,                    // "Pequena", "Média", "Grande", "Evento"
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
    console.error("Erro ao criar ação:", error);
    res.status(400).json({ erro: "Erro ao criar escalação de ação." });
  }
});

// 2. LISTAR TODAS AS AÇÕES (GET) - Com injeção automática de Armamento e Horário de Formação
router.get('/', async (req, res) => {
  try {
    const acoes = await prisma.acao.findMany({
      include: {
        participantes: {
          include: { 
            membro: true // Já traz os dados do membro (nome, passaporte, cargo) junto na lista
          }
        }
      },
      orderBy: { dataHora: 'asc' } // Mostra as ações mais próximas primeiro
    });

    // Mapeia o resultado para injetar as regras de negócio inteligentes
    const acoesFormatadas = acoes.map(acao => {
      const dataAcao = new Date(acao.dataHora);
      
      // Calcula o horário de formação subtraindo 45 minutos da hora original (45 * 60 * 1000 ms)
      const dataFormacao = new Date(dataAcao.getTime() - 45 * 60000);
      
      // Regra de Armamento Automático baseado no Porte da Ação de Tiro
      let armamentoSugerido = "Nenhum especificado";
      
      if (acao.tipoAcao === 'TIRO') {
        if (acao.porteAcao === 'Pequena') {
          armamentoSugerido = "Pistolas + Colete Leve";
        } else if (acao.porteAcao === 'Média') {
          armamentoSugerido = "Submetralhadoras (Mtar) + Colete";
        } else if (acao.porteAcao === 'Grande') {
          armamentoSugerido = "Fuzis (Sig / AK47) + Colete + Algema + Capuz";
        } else if (acao.porteAcao === 'Evento') {
          armamentoSugerido = "Armamento do Evento";
        }
      } else if (acao.tipoAcao === 'FUGA') {
        armamentoSugerido = "Fuga Limpa";
      }

      // Retorna o objeto da ação com os campos virtuais calculados na hora
      return {
        ...acao,
        horarioFormacao: dataFormacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        avisoAutomatico: `⚠️ FORMAÇÃO OBRIGATÓRIA ÀS ${dataFormacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (45 minutos antes)!`,
        armamentoNecessario: armamentoSugerido
      };
    });

    res.json(acoesFormatadas);
  } catch (error) {
    console.error("Erro ao buscar ações:", error);
    res.status(500).json({ erro: "Erro ao buscar ações." });
  }
});

// 3. SE CANDIDATAR A UMA VAGA (POST) - Com inteligência de Fila de Espera (Reserva)
router.post('/:id/inscrever', async (req, res) => {
  try {
    const acaoId = Number(req.params.id);
    const { membroId } = req.body;

    // 1. Busca a ação para verificar o limite de vagas
    const acao = await prisma.acao.findUnique({
      where: { id: acaoId },
      include: { participantes: true }
    });

    if (!acao) {
      return res.status(404).json({ erro: "Ação não encontrada." });
    }

    // 2. Conta quantos membros já preencheram as vagas principais
    const qtdPrincipais = acao.participantes.filter(p => p.tipoVaga === 'PRINCIPAL').length;

    // 3. Se ainda houver vaga no contador principal, entra como PRINCIPAL. Se não, vai automático para RESERVA.
    const tipoVaga = qtdPrincipais < acao.vagasTotais ? 'PRINCIPAL' : 'RESERVA';

    const novaInscricao = await prisma.participanteAcao.create({
      data: {
        acaoId,
        membroId: Number(membroId),
        tipoVaga
      },
      include: { 
        membro: true 
      }
    });

    res.status(201).json({
      mensagem: `Inscrição realizada com sucesso como ${tipoVaga}!`,
      dados: novaInscricao
    });

  } catch (error) {
    console.error("Erro ao inscrever membro:", error);
    res.status(400).json({ 
      erro: "Não foi possível concluir a inscrição. Você já pode estar inscrito nesta ação ou o membro informado é inválido." 
    });
  }
});

export default router;
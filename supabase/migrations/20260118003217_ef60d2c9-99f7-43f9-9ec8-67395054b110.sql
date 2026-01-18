-- Create storage bucket for dojo logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('dojo-logos', 'dojo-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for dojo logos bucket
CREATE POLICY "Anyone can view dojo logos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'dojo-logos');

CREATE POLICY "Authenticated users can upload dojo logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'dojo-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update dojo logos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'dojo-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete dojo logos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'dojo-logos' AND auth.role() = 'authenticated');

-- Create task templates table for pre-defined tasks by belt level
CREATE TABLE public.task_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  belt_level TEXT NOT NULL,
  martial_art TEXT NOT NULL DEFAULT 'judo',
  difficulty TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can read task templates
CREATE POLICY "Anyone can view task templates" 
ON public.task_templates 
FOR SELECT 
USING (true);

-- Only admins and senseis can manage task templates
CREATE POLICY "Admins and senseis can create task templates" 
ON public.task_templates 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'sensei', 'super_admin')
  )
);

CREATE POLICY "Admins and senseis can update task templates" 
ON public.task_templates 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'sensei', 'super_admin')
  )
);

CREATE POLICY "Admins and senseis can delete task templates" 
ON public.task_templates 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'sensei', 'super_admin')
  )
);

-- Seed with judo and jiu-jitsu task templates
INSERT INTO public.task_templates (title, description, category, belt_level, martial_art, difficulty) VALUES
-- JUDO - Faixa Branca (6º Kyu)
('Aprender Ukemi Mae (queda frontal)', 'Praticar a técnica de queda frontal com proteção das mãos e giro do corpo. Executar 20 repetições com supervisão.', 'physical', 'branca', 'judo', 'easy'),
('Aprender Ukemi Ushiro (queda para trás)', 'Dominar a técnica de queda para trás com proteção da cabeça e batida dos braços. Executar 20 repetições.', 'physical', 'branca', 'judo', 'easy'),
('Aprender Ukemi Yoko (queda lateral)', 'Praticar quedas laterais para ambos os lados. Executar 15 repetições de cada lado.', 'physical', 'branca', 'judo', 'easy'),
('Aprender O-soto-otoshi', 'Técnica de projeção com varredura externa. Praticar com uke parado e em movimento.', 'physical', 'branca', 'judo', 'medium'),
('Aprender De-ashi-barai', 'Técnica de varredura do pé avançado. Dominar o timing correto contra adversário em movimento.', 'physical', 'branca', 'judo', 'medium'),
('Estudar etiqueta do Dojo', 'Aprender as regras de comportamento, saudações (rei) e respeito no ambiente do dojo.', 'technical', 'branca', 'judo', 'easy'),
('Memorizar terminologia básica', 'Estudar e memorizar: Hajime, Matte, Rei, Dojo, Judogi, Tatami, Sensei, Uke, Tori.', 'technical', 'branca', 'judo', 'easy'),
('Aprender história do Judô', 'Estudar a vida de Jigoro Kano e a fundação do Kodokan em 1882. Apresentar resumo escrito.', 'technical', 'branca', 'judo', 'easy'),

-- JUDO - Faixa Cinza (5º Kyu)
('Aprender Uki-goshi', 'Técnica de projeção de quadril flutuante. Dominar entrada e rotação do quadril.', 'physical', 'cinza', 'judo', 'medium'),
('Aprender Kesa-gatame', 'Imobilização lateral. Manter controle por 20 segundos contra resistência moderada.', 'physical', 'cinza', 'judo', 'medium'),
('Praticar combinações de golpes', 'Combinar O-soto-gari com Kouchi-gari. Executar transições fluidas.', 'physical', 'cinza', 'judo', 'medium'),
('Aprender Osae-komi-waza básico', 'Estudar e praticar as 4 imobilizações básicas: Kesa, Yoko, Kami e Tate-shiho-gatame.', 'physical', 'cinza', 'judo', 'medium'),
('Estudar princípios do Judô', 'Compreender Seiryoku Zenyo (máxima eficiência) e Jita Kyoei (prosperidade mútua).', 'technical', 'cinza', 'judo', 'medium'),

-- JUDO - Faixa Azul (4º Kyu)
('Aprender Seoi-nage', 'Técnica de projeção sobre os ombros. Dominar entrada e controle do braço do uke.', 'physical', 'azul', 'judo', 'medium'),
('Aprender Harai-goshi', 'Varredura de quadril. Praticar timing e kuzushi (desequilíbrio) adequado.', 'physical', 'azul', 'judo', 'hard'),
('Praticar Ne-waza transições', 'Trabalhar transições entre imobilizações e escapes. 10 minutos de randori de solo.', 'physical', 'azul', 'judo', 'medium'),
('Estudar regras de competição', 'Aprender pontuação (Ippon, Waza-ari), penalidades e tempo de luta.', 'technical', 'azul', 'judo', 'medium'),

-- JUDO - Faixa Amarela (3º Kyu)
('Aprender Tai-otoshi', 'Projeção com bloqueio do corpo. Dominar posicionamento e momento correto.', 'physical', 'amarela', 'judo', 'hard'),
('Aprender Uchi-mata', 'Técnica de varredura interna da coxa. Uma das técnicas mais importantes do judô.', 'physical', 'amarela', 'judo', 'hard'),
('Praticar Kansetsu-waza básico', 'Introdução às chaves de braço: Juji-gatame e Ude-garami.', 'physical', 'amarela', 'judo', 'hard'),
('Estudar biomecânica das técnicas', 'Compreender os princípios de alavanca, centro de gravidade e momento nas projeções.', 'technical', 'amarela', 'judo', 'medium'),

-- JUDO - Faixa Laranja (2º Kyu)
('Aprender Ashi-guruma', 'Roda de perna. Técnica avançada de projeção com bloqueio da perna.', 'physical', 'laranja', 'judo', 'hard'),
('Praticar Shime-waza', 'Técnicas de estrangulamento: Hadaka-jime, Okuri-eri-jime, Kata-ha-jime.', 'physical', 'laranja', 'judo', 'hard'),
('Desenvolver Tokui-waza', 'Identificar e aperfeiçoar sua técnica especial (favorita).', 'physical', 'laranja', 'judo', 'hard'),
('Estudar Nage-no-kata (parte 1)', 'Aprender as primeiras 5 técnicas do kata de projeções.', 'technical', 'laranja', 'judo', 'hard'),

-- JUDO - Faixa Verde (1º Kyu)
('Dominar combinações avançadas', 'Encadear 3 ou mais técnicas em sequência fluida. Ataque-contra-ataque-finalização.', 'physical', 'verde', 'judo', 'hard'),
('Aperfeiçoar defesas e contra-ataques', 'Desenvolver respostas automáticas para ataques comuns.', 'physical', 'verde', 'judo', 'hard'),
('Completar Nage-no-kata', 'Demonstrar todas as 15 técnicas do kata de projeções com uke.', 'technical', 'verde', 'judo', 'hard'),
('Ensinar técnicas básicas', 'Auxiliar o sensei ensinando ukemi e técnicas básicas para faixas iniciantes.', 'administrative', 'verde', 'judo', 'hard'),

-- JUDO - Faixas Marrom/Preta
('Preparação para exame de faixa preta', 'Revisar todas as técnicas do gokyo. Demonstrar domínio técnico completo.', 'physical', 'marrom', 'judo', 'hard'),
('Estudar Katame-no-kata', 'Dominar o kata de técnicas de controle no solo.', 'technical', 'marrom', 'judo', 'hard'),
('Desenvolver filosofia do Judô', 'Escrever ensaio sobre a aplicação dos princípios do judô na vida diária.', 'technical', 'preta_1dan', 'judo', 'hard'),

-- JIU-JITSU - Faixa Branca
('Aprender postura base (posture)', 'Dominar a postura defensiva básica na guarda e em cima.', 'physical', 'branca', 'jiu-jitsu', 'easy'),
('Aprender fuga do mount (upa)', 'Técnica de escape quando o oponente está montado. Executar 20 repetições.', 'physical', 'branca', 'jiu-jitsu', 'easy'),
('Aprender fuga lateral (elbow escape)', 'Escape da side control usando os cotovelos. Praticar para ambos os lados.', 'physical', 'branca', 'jiu-jitsu', 'easy'),
('Aprender guarda fechada básica', 'Controle do oponente na guarda fechada. Entender quebra de postura.', 'physical', 'branca', 'jiu-jitsu', 'easy'),
('Aprender armlock da guarda', 'Finalização básica a partir da guarda fechada.', 'physical', 'branca', 'jiu-jitsu', 'medium'),
('Aprender triângulo (triangle choke)', 'Estrangulamento com as pernas a partir da guarda.', 'physical', 'branca', 'jiu-jitsu', 'medium'),
('Estudar história do BJJ', 'Aprender sobre a família Gracie e a evolução do jiu-jitsu no Brasil.', 'technical', 'branca', 'jiu-jitsu', 'easy'),
('Aprender terminologia básica', 'Estudar: Guarda, Passagem, Raspagem, Finalização, Posição, Sweep.', 'technical', 'branca', 'jiu-jitsu', 'easy'),

-- JIU-JITSU - Faixa Azul
('Desenvolver jogo de guarda', 'Escolher e aprofundar em 2-3 tipos de guarda: fechada, aberta, meia-guarda.', 'physical', 'azul', 'jiu-jitsu', 'medium'),
('Aprender passagens de guarda', 'Dominar pelo menos 3 passagens diferentes: toreando, over-under, knee slice.', 'physical', 'azul', 'jiu-jitsu', 'medium'),
('Praticar raspagens (sweeps)', 'Desenvolver 3-4 raspagens eficientes a partir de diferentes guardas.', 'physical', 'azul', 'jiu-jitsu', 'medium'),
('Aprender back takes', 'Técnicas para pegar as costas: a partir da guarda, de cima, do lado.', 'physical', 'azul', 'jiu-jitsu', 'medium'),
('Estudar conceitos de alavanca', 'Compreender como maximizar força através de posicionamento e alavancas.', 'technical', 'azul', 'jiu-jitsu', 'medium'),
('Praticar defesas de finalizações', 'Desenvolver escapes para armlock, kimura, triângulo e mata-leão.', 'physical', 'azul', 'jiu-jitsu', 'hard'),

-- JIU-JITSU - Faixa Roxa
('Desenvolver jogo pessoal', 'Identificar e especializar em posições que combinam com seu físico e estilo.', 'physical', 'roxa', 'jiu-jitsu', 'hard'),
('Aprender leg locks básicos', 'Introdução a ataques de perna: ankle lock, kneebar (onde permitido).', 'physical', 'roxa', 'jiu-jitsu', 'hard'),
('Praticar transições fluidas', 'Encadear ataques e posições sem pausas. Desenvolver flow.', 'physical', 'roxa', 'jiu-jitsu', 'hard'),
('Auxiliar na instrução', 'Ajudar o professor com alunos iniciantes. Desenvolver habilidades de ensino.', 'administrative', 'roxa', 'jiu-jitsu', 'medium'),
('Estudar estratégia de competição', 'Aprender sobre gerenciamento de tempo, pontuação e táticas.', 'technical', 'roxa', 'jiu-jitsu', 'medium'),

-- JIU-JITSU - Faixa Marrom
('Aperfeiçoar sistema de jogo', 'Desenvolver um sistema completo: guardas, passagens, finalizações interligadas.', 'physical', 'marrom', 'jiu-jitsu', 'hard'),
('Dominar leg lock game', 'Aprofundar em sistemas de ataque de perna: inside sankaku, 50/50, ashi garami.', 'physical', 'marrom', 'jiu-jitsu', 'hard'),
('Estudar diferentes estilos', 'Analisar técnicas de competidores de alto nível de diferentes academias.', 'technical', 'marrom', 'jiu-jitsu', 'hard'),
('Desenvolver habilidades de coaching', 'Preparar e executar aulas completas. Desenvolver metodologia de ensino.', 'administrative', 'marrom', 'jiu-jitsu', 'hard'),

-- JIU-JITSU - Faixa Preta
('Aperfeiçoar detalhes técnicos', 'Refinar micro-ajustes em todas as posições. Buscar a perfeição técnica.', 'physical', 'preta_1dan', 'jiu-jitsu', 'hard'),
('Desenvolver metodologia de ensino', 'Criar curriculum estruturado para ensinar diferentes níveis.', 'administrative', 'preta_1dan', 'jiu-jitsu', 'hard'),
('Contribuir para a comunidade', 'Organizar seminários, competições ou eventos para promover o jiu-jitsu.', 'administrative', 'preta_1dan', 'jiu-jitsu', 'hard'),
('Estudar filosofia do BJJ', 'Escrever sobre a aplicação dos princípios do jiu-jitsu na vida pessoal e profissional.', 'technical', 'preta_1dan', 'jiu-jitsu', 'hard');
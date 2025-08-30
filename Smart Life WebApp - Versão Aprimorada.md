# Smart Life WebApp - Versão Aprimorada

Esta é uma versão aprimorada do projeto original smart-life-webapp com suporte adicional para leitura de propriedades avançadas dos dispositivos Tuya.

## Novas Funcionalidades

### 1. Suporte para Dimmer/Brilho
- **Leitura do percentual de brilho** (0-100%)
- Exibição visual com barra de progresso
- Suporte para diferentes propriedades de brilho: `bright_value`, `bright_value_1`, `brightness`, `dimmer`
- Conversão automática de valores (0-1000 para 0-100%)

### 2. Suporte para Cor das Luzes
- **Leitura de informações de cor** em formato HSV
- Visualização da cor atual com preview colorido
- Exibição dos valores HSV (Hue, Saturation, Value)
- Suporte para propriedades: `colour_data`, `color_data`, `colour`, `color`, `hsv`, `rgb`
- Parser automático para formato Tuya (hhhssssvvv)

### 3. Suporte para Cenas
- **Seção dedicada para cenas** separada dos dispositivos
- Listagem de todas as cenas disponíveis
- Ativação de cenas com feedback visual
- Cache local das cenas para melhor performance

### 4. Informações Adicionais
- **Temperatura de cor** para luzes compatíveis
- **Modo de trabalho** (branco, colorido, cena, música)
- **Modo debug** para visualizar dados brutos dos dispositivos
- Interface mais organizada e intuitiva

## Arquivos Modificados/Criados

### Novos Arquivos:
- `src/libs/tuya-enhanced.js` - Cliente Tuya aprimorado
- `src/views/HomeEnhanced.vue` - Interface aprimorada
- `README-ENHANCED.md` - Esta documentação

### Arquivos Modificados:
- `src/router/index.js` - Adicionada rota `/enhanced`
- `src/App.vue` - Navegação entre versões

## Como Usar

### Acessar a Versão Aprimorada
1. Inicie o servidor de desenvolvimento: `npm run serve`
2. Acesse `http://localhost:3000/enhanced`
3. Faça login com suas credenciais Tuya/Smart Life
4. Clique em "Refresh" para carregar dispositivos
5. Clique em "Refresh Scenes" para carregar cenas

### Funcionalidades da Interface

#### Dispositivos
- **Ícone de energia**: Liga/desliga dispositivos
- **Informações de brilho**: Barra de progresso mostrando % atual
- **Informações de cor**: Preview da cor + valores HSV
- **Temperatura de cor**: Valor em Kelvin
- **Modo de trabalho**: Modo atual do dispositivo

#### Cenas
- **Seção separada**: Cenas aparecem no topo da página
- **Ativação simples**: Clique no botão play para ativar
- **Feedback**: Mensagem de confirmação ao ativar

#### Debug
- **Botão de debug**: Mostra/oculta informações técnicas
- **Dados brutos**: JSON completo dos dispositivos para desenvolvimento

## API Tuya Utilizada

### Endpoints Principais:
- `GET /v1.0/devices/{device_id}/status` - Status atual do dispositivo
- `GET /v1.0/devices/{device_id}/functions` - Funções suportadas
- `GET /v1.1/homes/{home_id}/scenes` - Cenas disponíveis
- `POST /v1.0/devices/{device_id}/commands` - Controle de dispositivos

### Propriedades Suportadas:

#### Dimmer/Brilho:
- `bright_value` - Valor de brilho (0-1000)
- `bright_value_1` - Valor de brilho canal 1
- `brightness` - Brilho genérico
- `dimmer` - Controle dimmer

#### Cor:
- `colour_data` - Dados de cor em formato HSV
- `color_data` - Dados de cor alternativos
- `hsv` - Valores HSV diretos
- `rgb` - Valores RGB

#### Outros:
- `temp_value` - Temperatura de cor
- `work_mode` - Modo de operação
- `switch_led` - Estado liga/desliga

## Limitações Atuais

1. **Somente Leitura**: As propriedades são exibidas apenas para visualização
2. **Dependente da API**: Funcionalidades dependem do suporte da API Tuya
3. **Cache Local**: Dados são armazenados localmente para performance
4. **Compatibilidade**: Nem todos os dispositivos suportam todas as propriedades

## Desenvolvimento Futuro

### Possíveis Melhorias:
1. **Controle Interativo**: Sliders para ajustar brilho e cor
2. **Criação de Cenas**: Interface para criar novas cenas
3. **Automações**: Suporte para automações/regras
4. **Histórico**: Registro de mudanças de estado
5. **Grupos**: Agrupamento de dispositivos
6. **Temas**: Suporte para temas escuro/claro

### Estrutura do Código:
- **Modular**: Separação clara entre cliente API e interface
- **Extensível**: Fácil adição de novas propriedades
- **Compatível**: Mantém compatibilidade com versão original
- **Documentado**: Código bem comentado para manutenção

## Tecnologias Utilizadas

- **Vue 3** - Framework frontend
- **Element Plus** - Biblioteca de componentes UI
- **Axios** - Cliente HTTP
- **Vue Router** - Roteamento
- **Material Icons** - Ícones da interface

## Suporte

Para dúvidas ou problemas:
1. Verifique os logs do console do navegador
2. Use o modo debug para ver dados brutos
3. Consulte a documentação oficial da API Tuya
4. Verifique se o dispositivo suporta as propriedades desejadas


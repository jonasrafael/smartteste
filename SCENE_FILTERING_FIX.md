# Correção do Filtro de Cenas e Automações

## Problema Identificado

As cenas e automações estavam aparecendo na lista de dispositivos como se fossem dispositivos normais, causando confusão na interface do usuário.

## Causa Raiz

O filtro original apenas removia dispositivos do tipo `automation`, mas não removia:
- Dispositivos do tipo `scene`
- Dispositivos com nomes que contêm palavras relacionadas a cenas/automações
- Cenas que não terminavam com o sufixo `#`

## Soluções Implementadas

### 1. Melhorado o Filtro de Dispositivos

Em todos os arquivos (`tuya.js`, `tuya-enhanced.js`, `Home.vue`), foi implementado um filtro mais robusto que remove:

```javascript
const isScene = device.type === "scene";
const isAutomation = device.type === "automation";
const isSceneLike = device.name.toLowerCase().includes("scene") || 
                   device.name.toLowerCase().includes("cena") ||
                   device.name.toLowerCase().includes("automation") ||
                   device.name.toLowerCase().includes("automação");

// Remove todos os tipos de cenas/automações da lista de dispositivos
return !isScene && !isAutomation && !isSceneLike;
```

### 2. Melhorada a Função getScenes()

A função `getScenes()` no `tuya-enhanced.js` agora:
- Captura tanto cenas quanto automações
- Identifica dispositivos "scene-like" baseado no nome
- Limpa nomes de cenas (remove sufixo `#`)
- Trata nomes com escape JSON
- Fornece ícones padrão para cenas

### 3. Filtro Aplicado em Múltiplas Camadas

- **Camada de API** (`tuya.js`, `tuya-enhanced.js`): Filtra na descoberta de dispositivos
- **Camada de View** (`Home.vue`, `HomeEnhanced.vue`): Filtra na renderização da interface

## Resultado

Agora as cenas e automações:
- ✅ Aparecem apenas na seção "Cenas" (quando disponível)
- ❌ Não aparecem mais na lista de dispositivos
- ✅ São identificadas corretamente independente do nome ou tipo
- ✅ Mantêm funcionalidade completa (podem ser ativadas)

## Arquivos Modificados

1. `src/libs/tuya.js` - Filtro de dispositivos melhorado
2. `src/libs/tuya-enhanced.js` - Filtro e função getScenes melhorados
3. `src/views/Home.vue` - Filtro adicional na view
4. `src/views/HomeEnhanced.vue` - Já tinha tratamento separado para cenas

## Como Testar

1. Faça login na aplicação
2. Atualize a lista de dispositivos
3. Verifique que cenas/automações não aparecem mais na lista de dispositivos
4. Se estiver usando `HomeEnhanced.vue`, verifique que as cenas aparecem na seção "Cenas"
5. Teste se as cenas ainda podem ser ativadas normalmente

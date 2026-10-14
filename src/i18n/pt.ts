/**
 * Textos do plugin em português, que é o idioma-base: os tipos de `MessageKey`
 * e de `Messages` saem daqui, e o inglês (en.ts) precisa ter as mesmas chaves.
 * Use `{nome}` para valores que entram na frase.
 */
export const pt = {
  "color.amber": "Âmbar",
  "color.askAlways": "Perguntar sempre",
  "color.blue": "Azul",
  "color.custom": "Escolher outra cor",
  "color.cyan": "Ciano",
  "color.default": "Padrão",
  "color.emerald": "Esmeralda",
  "color.fuchsia": "Fúcsia",
  "color.gray": "Cinza",
  "color.green": "Verde",
  "color.indigo": "Anil",
  "color.lime": "Lima",
  "color.orange": "Laranja",
  "color.pink": "Rosa",
  "color.purple": "Roxo",
  "color.red": "Vermelho",
  "color.rose": "Rosé",
  "color.sky": "Céu",
  "color.teal": "Verde-azulado",
  "color.tooltip": "Cor do ícone",
  "color.violet": "Violeta",
  "color.yellow": "Amarelo",

  "command.changeCover": "Alterar capa",
  "command.changeIcon": "Alterar ícone",
  "command.removeCover": "Remover capa",

  "common.cancel": "Cancelar",
  "common.remove": "Remover",
  "common.save": "Salvar",

  "cover.linkHint": "Funciona com qualquer imagem da web.",
  "cover.linkPlaceholder": "Cole o link da imagem…",
  "cover.linkSubmit": "Enviar",
  "cover.noPhotos": "Nenhuma foto encontrada.",
  "cover.photoBy": "Foto de {name}",
  "cover.searching": "Buscando…",
  "cover.unsplashHint": "Fotos de alta resolução do Unsplash.",
  "cover.unsplashNoKey":
    "Cole sua Access Key do Unsplash nas configurações do plugin para buscar fotos.",
  "cover.unsplashPlaceholder": "Pesquise uma imagem e tecle Enter…",
  "cover.uploadButton": "Carregar arquivo",
  "cover.uploadHint":
    "Arraste uma imagem para cá ou Ctrl+V para colar uma imagem. Imagens com mais de 1500 pixels de largura funcionam melhor.",

  "emojiGroup.activities": "Atividades",
  "emojiGroup.flags": "Bandeiras",
  "emojiGroup.food": "Comida e bebida",
  "emojiGroup.nature": "Animais e natureza",
  "emojiGroup.objects": "Objetos",
  "emojiGroup.people": "Pessoas e corpo",
  "emojiGroup.smileys": "Sorrisos e emoção",
  "emojiGroup.symbols": "Símbolos",
  "emojiGroup.travel": "Viagens e lugares",

  "gallery.asianArt": "Museu Nacional de Arte Asiática",
  "gallery.colorsAndGradients": "Cor e gradiente",
  "gallery.hudson": "Museu MET · Hudson River School",
  "gallery.japanesePrints": "Gravuras japonesas · Museu MET",
  "gallery.pastel": "Pastel",
  "gallery.pomological": "Aquarelas pomológicas do USDA",
  "gallery.rijksmuseum": "Rijksmuseum",

  "gradient.aurora": "Aurora",
  "gradient.blue": "Azul",
  "gradient.cream": "Creme",
  "gradient.dusk": "Crepúsculo",
  "gradient.ember": "Brasa",
  "gradient.fire": "Fogo",
  "gradient.forest": "Floresta",
  "gradient.haze": "Névoa",
  "gradient.lagoon": "Lagoa",
  "gradient.lavender": "Lavanda",
  "gradient.magenta": "Magenta",
  "gradient.mint": "Menta",
  "gradient.nebula": "Nebulosa",
  "gradient.night": "Noite",
  "gradient.ocean": "Oceano",
  "gradient.peach": "Pêssego",
  "gradient.red": "Vermelho",
  "gradient.rose": "Rosa",
  "gradient.sand": "Areia",
  "gradient.slate": "Ardósia",
  "gradient.sunset": "Pôr do sol",
  "gradient.violet": "Violeta",
  "gradient.yellow": "Amarelo",

  "header.addCover": "Adicionar capa",
  "header.addIcon": "Adicionar ícone",
  "header.change": "Alterar",
  "header.changeIcon": "Trocar ícone",
  "header.reposition": "Reposicionar",
  "header.repositionHint": "Arraste a imagem para reposicionar",
  "header.savePosition": "Salvar posição",

  "iconPicker.filterEmoji": "Filtrar…",
  "iconPicker.filterIcons": "Filtrar ícones…",
  "iconPicker.noEmoji": "Nenhum emoji encontrado.",
  "iconPicker.noIcons": "Nenhum ícone encontrado.",
  "iconPicker.random": "Aleatório",
  "iconPicker.recent": "Recentes",
  "iconPicker.results": "Resultados",

  "iconUpload.change": "Trocar imagem",
  "iconUpload.choose": "Carregar uma imagem",
  "iconUpload.pasteHint": "ou Ctrl+V para colar uma imagem ou link",

  "notice.chooseImage": "Escolha um arquivo de imagem.",
  "notice.openNote": "Abra uma nota primeiro.",
  "notice.saveFailed": "Não foi possível salvar a imagem.",
  "notice.saveFailedReason": "Não foi possível salvar a imagem: {reason}",

  "settings.coverFade.desc":
    "Quanto da capa, de baixo para cima, some em degradê até a nota. Zero desliga o efeito.",
  "settings.coverFade.name": "Degradê na parte de baixo",
  "settings.coverHeight.desc": "Altura padrão da capa em pixels.",
  "settings.coverHeight.name": "Altura da capa",
  "settings.coverRadius.desc":
    "Raio dos cantos da capa em pixels. Zero deixa os cantos retos.",
  "settings.coverRadius.name": "Cantos arredondados",
  "settings.coverShade.desc":
    "Quanto da capa, de baixo para cima, escurece em degradê preto. Destaca o ícone e o crédito sobre imagens claras. Zero desliga o efeito.",
  "settings.coverShade.name": "Sombra na parte de baixo",
  "settings.language.auto": "Automático",
  "settings.language.desc":
    "Idioma do plugin. Automático segue o idioma do Obsidian; quando ele não é o português, usa o inglês. Os nomes dos comandos só mudam ao recarregar o Obsidian.",
  "settings.language.name": "Idioma",
  "settings.toc.desc":
    "Mostra um traço por título na borda direita da nota, com a seção atual em destaque. Passe o mouse para ver os títulos e clique para ir até um deles.",
  "settings.toc.name": "Sumário na lateral",
  "settings.twemoji.desc":
    "Desenha os emojis com o Twemoji. As imagens são baixadas do jsDelivr (cdn.jsdelivr.net) na primeira vez que aparecem e ficam guardadas na pasta do plugin; nada da nota é enviado. Desligado, usa os emojis do sistema.",
  "settings.twemoji.name": "Emojis no estilo do X",
  "settings.unsplashKey.desc":
    "Access Key da sua aplicação em unsplash.com/developers. Necessária apenas para a aba Unsplash.",
  "settings.unsplashKey.name": "Chave de acesso do Unsplash",
  "settings.unsplashKey.placeholder": "Cole a Access Key",

  "tab.emoji": "Emoji",
  "tab.gallery": "Galeria",
  "tab.icons": "Ícones",
  "tab.link": "Link",
  "tab.upload": "Carregar",
  "tab.uploadIcon": "Fazer upload",

  "toc.untitled": "Sem título",

  "unsplash.invalidKey": "Access Key do Unsplash inválida.",
  "unsplash.rateLimit":
    "Limite de requisições do Unsplash atingido. O plano gratuito permite 50 por hora.",
  "unsplash.searchFailed": "Falha na busca do Unsplash (HTTP {status}).",
} as const;

export type MessageKey = keyof typeof pt;
export type Messages = Record<MessageKey, string>;

export interface EmojiEntry {
  emoji: string;
  /** Palavras usadas no filtro, em português, sem distinção de acento. */
  keywords: string;
}

export interface EmojiGroup {
  name: string;
  /** Ícone Lucide do grupo na barra de categorias. */
  icon: string;
  emojis: EmojiEntry[];
}

const e = (emoji: string, keywords: string): EmojiEntry => ({
  emoji,
  keywords,
});

/** Emojis da aba Emoji, em grupos na ordem em que aparecem. */
export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    emojis: [
      e("📝", "nota memo escrever lapis papel"),
      e("📄", "pagina documento papel arquivo"),
      e("📒", "caderno livro amarelo"),
      e("📓", "caderno anotacoes"),
      e("📔", "caderno diario capa"),
      e("📕", "livro vermelho fechado"),
      e("📖", "livro aberto leitura ler"),
      e("🗒️", "bloco de notas espiral lista"),
      e("🗂️", "pastas divisorias organizar arquivo"),
      e("📌", "alfinete fixar tachinha"),
      e("📎", "clipe anexo"),
      e("🔖", "marcador favorito"),
      e("🏷️", "etiqueta tag rotulo"),
      e("📚", "livros estudo biblioteca"),
      e("🗃️", "fichario caixa arquivo"),
      e("✏️", "lapis escrever editar"),
    ],
    icon: "notebook-pen",
    name: "Notas",
  },
  {
    emojis: [
      e("💡", "ideia lampada luz"),
      e("🎯", "alvo meta objetivo foco"),
      e("🚀", "foguete lancamento projeto"),
      e("⭐", "estrela favorito"),
      e("✨", "brilho magia novo"),
      e("🔥", "fogo quente urgente"),
      e("🧠", "cerebro mente pensar"),
      e("🌱", "broto planta crescer comeco"),
      e("🧭", "bussola direcao rumo"),
      e("🗺️", "mapa viagem roteiro"),
      e("🔍", "lupa busca pesquisa procurar"),
      e("⚡", "raio energia rapido"),
      e("🎨", "arte pintura paleta design"),
      e("🧩", "quebra-cabeca peca puzzle"),
      e("🪄", "varinha magia"),
      e("💎", "diamante joia valor"),
    ],
    icon: "lightbulb",
    name: "Ideias",
  },
  {
    emojis: [
      e("💼", "maleta trabalho negocio"),
      e("📊", "grafico barras dados relatorio"),
      e("📈", "grafico crescimento alta"),
      e("📅", "calendario data agenda"),
      e("🗓️", "calendario espiral agenda planejamento"),
      e("⏰", "despertador relogio hora prazo"),
      e("✅", "feito concluido check tarefa"),
      e("☑️", "caixa marcada check tarefa"),
      e("📋", "prancheta lista tarefas"),
      e("🧾", "recibo nota conta"),
      e("💰", "dinheiro saco financas"),
      e("🛠️", "ferramentas martelo chave"),
      e("⚙️", "engrenagem configuracao"),
      e("🔧", "chave inglesa ferramenta conserto"),
      e("📦", "caixa pacote entrega"),
      e("🏗️", "construcao obra guindaste"),
    ],
    icon: "briefcase",
    name: "Trabalho",
  },
  {
    emojis: [
      e("🌍", "terra mundo planeta europa africa"),
      e("🌎", "terra mundo planeta americas"),
      e("🌳", "arvore natureza"),
      e("🌸", "flor cerejeira primavera"),
      e("🌻", "girassol flor"),
      e("🍀", "trevo sorte"),
      e("🌊", "onda mar oceano agua"),
      e("🏔️", "montanha neve"),
      e("🌙", "lua noite"),
      e("☀️", "sol dia verao"),
      e("🌈", "arco-iris cores"),
      e("❄️", "floco de neve frio inverno"),
      e("🐶", "cachorro cao animal"),
      e("🐱", "gato animal"),
      e("🦊", "raposa animal"),
      e("🦉", "coruja sabedoria animal"),
    ],
    icon: "leaf",
    name: "Natureza",
  },
  {
    emojis: [
      e("🙂", "sorriso rosto feliz"),
      e("😎", "oculos escuros legal rosto"),
      e("🤔", "pensando duvida rosto"),
      e("🥳", "festa comemoracao rosto"),
      e("🧑‍💻", "programador computador tecnologia pessoa"),
      e("👩‍🎨", "artista pintora pessoa"),
      e("👨‍🍳", "cozinheiro chef pessoa"),
      e("🧘", "meditacao yoga calma"),
      e("🏃", "correr corrida exercicio"),
      e("🎓", "formatura estudo escola universidade"),
      e("❤️", "coracao amor vermelho"),
      e("🫶", "maos coracao carinho"),
      e("🙏", "maos rezar obrigado por favor"),
      e("👀", "olhos ver olhar"),
      e("🤝", "aperto de mao acordo parceria"),
      e("💪", "forca musculo braco academia"),
    ],
    icon: "smile",
    name: "Pessoas",
  },
  {
    emojis: [
      e("☕", "cafe xicara bebida"),
      e("🍵", "cha xicara bebida"),
      e("🍎", "maca fruta"),
      e("🍕", "pizza comida"),
      e("🍰", "bolo doce sobremesa"),
      e("🍷", "vinho taca bebida"),
      e("🎵", "musica nota"),
      e("🎬", "filme cinema claquete"),
      e("🎮", "videogame jogo controle"),
      e("📷", "camera foto"),
      e("✈️", "aviao viagem voo"),
      e("🏖️", "praia ferias guarda-sol"),
      e("🏠", "casa lar"),
      e("🛏️", "cama dormir quarto"),
      e("🎁", "presente aniversario"),
      e("🎉", "festa comemoracao confete"),
    ],
    icon: "coffee",
    name: "Comida e lazer",
  },
];

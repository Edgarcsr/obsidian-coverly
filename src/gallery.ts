import type { CreditInfo } from "./note-data";

/**
 * Capas prontas da aba Galeria. Gradientes ficam gravados na nota como
 * `gradient:<id>`; obras de arte, pela URL da imagem, como um link comum.
 *
 * As obras são de domínio público e vêm das fontes abertas dos próprios
 * acervos (API Open Access do MET e Wikimedia Commons), nunca de cópias do Notion.
 */

export interface GradientPreset {
  kind: "gradient";
  id: string;
  name: string;
  css: string;
}

export interface ArtworkPreset {
  kind: "artwork";
  id: string;
  name: string;
  /** Imagem leve para a grade da galeria. */
  thumb: string;
  /** Imagem usada na capa. */
  url: string;
  credit: CreditInfo;
}

export type GalleryItem = GradientPreset | ArtworkPreset;

export interface GallerySection {
  title: string;
  items: GalleryItem[];
}

const gradient = (id: string, name: string, css: string): GradientPreset => ({
  css,
  id,
  kind: "gradient",
  name,
});

/** Cor sólida no mesmo formato dos gradientes, para caber na mesma camada da capa. */
const solid = (id: string, name: string, color: string): GradientPreset =>
  gradient(id, name, `linear-gradient(${color}, ${color})`);

/** Obra do MET. `image` é o caminho da versão "web-large" (~100 a 300 KB). */
const met = (
  objectId: string,
  image: string,
  title: string,
  artist: string
): ArtworkPreset => {
  const url = `https://images.metmuseum.org/CRDImages/${image}`;
  return {
    credit: {
      name: `${artist}, ${title} · The Met`,
      url: `https://www.metmuseum.org/art/collection/search/${objectId}`,
    },
    id: `met-${objectId}`,
    kind: "artwork",
    name: `${title}, ${artist}`,
    thumb: url,
    url,
  };
};

/** Obra hospedada no Wikimedia Commons; o próprio Commons gera as miniaturas. */
const commons = (
  file: string,
  title: string,
  artist: string,
  museum: string
): ArtworkPreset => {
  const path = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}`;
  return {
    credit: {
      name: `${artist}, ${title} · ${museum}`,
      url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`,
    },
    id: `commons-${file}`,
    kind: "artwork",
    name: `${title}, ${artist}`,
    thumb: `${path}?width=400`,
    url: `${path}?width=2000`,
  };
};

const COLORS_AND_GRADIENTS: GalleryItem[] = [
  solid("red", "Vermelho", "#e8555a"),
  solid("yellow", "Amarelo", "#f7be4f"),
  solid("blue", "Azul", "#1f96d1"),
  solid("cream", "Creme", "#fdefe3"),
  gradient(
    "lagoon",
    "Lagoa",
    "linear-gradient(180deg, #5fd4d6 0%, #e8b7a8 100%)"
  ),
  gradient(
    "magenta",
    "Magenta",
    "linear-gradient(135deg, #ff3d8b 0%, #ff2477 100%)"
  ),
  gradient("fire", "Fogo", "linear-gradient(160deg, #d9674c 0%, #f61c0a 100%)"),
  gradient(
    "haze",
    "Névoa",
    "radial-gradient(circle at 30% 25%, #f5c2b8 0%, transparent 55%), linear-gradient(180deg, #fbe3dc 0%, #8fc4dc 100%)"
  ),
  gradient(
    "nebula",
    "Nebulosa",
    "radial-gradient(circle at 12% 88%, #f2a6d6 0%, transparent 45%), linear-gradient(120deg, #2a5ea8 0%, #8e3a6f 55%, #e2381c 100%)"
  ),
  gradient(
    "violet",
    "Violeta",
    "linear-gradient(160deg, #5d3fd3 0%, #c0466c 100%)"
  ),
  gradient(
    "dusk",
    "Crepúsculo",
    "linear-gradient(135deg, #1f4167 0%, #c9a08a 100%)"
  ),
];

const JAPANESE_PRINTS: GalleryItem[] = [
  met(
    "45434",
    "as/web-large/DP130155.jpg",
    "Sob a onda de Kanagawa",
    "Katsushika Hokusai"
  ),
  met(
    "36492",
    "as/web-large/DP140976.jpg",
    "Tempestade abaixo do Monte Fuji",
    "Katsushika Hokusai"
  ),
  met(
    "56132",
    "as/web-large/DP141010.jpg",
    "Ushibori, província de Hitachi",
    "Katsushika Hokusai"
  ),
  met(
    "56787",
    "as/web-large/DP141033.jpg",
    "Fujimigahara, província de Owari",
    "Katsushika Hokusai"
  ),
  met(
    "37193",
    "as/web-large/DP148844.jpg",
    "Vila à beira-mar no inverno",
    "Katsushika Hokusai"
  ),
  met(
    "55433",
    "as/web-large/DP130156.jpg",
    "Chuva repentina sobre a ponte Shin-Ōhashi",
    "Utagawa Hiroshige"
  ),
  met(
    "56915",
    "as/web-large/DP109333.jpg",
    "Neve ao entardecer em Kanbara",
    "Utagawa Hiroshige"
  ),
  met(
    "36521",
    "as/web-large/DP122216.jpg",
    "Chuva repentina em Shōno",
    "Utagawa Hiroshige"
  ),
];

const HUDSON_RIVER_SCHOOL: GalleryItem[] = [
  met(
    "10481",
    "ad/web-large/DT78.jpg",
    "O coração dos Andes",
    "Frederic Edwin Church"
  ),
  met(
    "10482",
    "ad/web-large/DT1540.jpg",
    "O Partenon",
    "Frederic Edwin Church"
  ),
  met(
    "10497",
    "ad/web-large/DP-12550-001.jpg",
    "Vista do Monte Holyoke (O Meandro)",
    "Thomas Cole"
  ),
  met(
    "10501",
    "ad/web-large/DT2639.jpg",
    "Vista do Catskill no início do outono",
    "Thomas Cole"
  ),
  met(
    "10154",
    "ad/web-large/DT82.jpg",
    "As Montanhas Rochosas, Pico Lander",
    "Albert Bierstadt"
  ),
  met(
    "10150",
    "ad/web-large/DT2961.jpg",
    "Rio Merced, Vale de Yosemite",
    "Albert Bierstadt"
  ),
  met(
    "10946",
    "ad/web-large/DT81.jpg",
    "Um desfiladeiro nas montanhas",
    "Sanford Robinson Gifford"
  ),
  met(
    "11313",
    "ad/web-large/ap74.11.jpg",
    "Lago George, uma lembrança",
    "John Frederick Kensett"
  ),
];

const RIJKSMUSEUM = "Rijksmuseum";

const RIJKSMUSEUM_WORKS: GalleryItem[] = [
  commons(
    "Johannes_Vermeer_-_Het_melkmeisje_-_Google_Art_Project.jpg",
    "A leiteira",
    "Johannes Vermeer",
    RIJKSMUSEUM
  ),
  commons(
    "Johannes_Vermeer_-_Gezicht_op_huizen_in_Delft,_bekend_als_'Het_straatje'_-_Google_Art_Project.jpg",
    "A ruazinha",
    "Johannes Vermeer",
    RIJKSMUSEUM
  ),
  commons(
    "The_Nightwatch_by_Rembrandt_-_Rijksmuseum.jpg",
    "A ronda noturna",
    "Rembrandt",
    RIJKSMUSEUM
  ),
  commons(
    "De_bedreigde_zwaan_Rijksmuseum_SK-A-4.jpeg",
    "O cisne ameaçado",
    "Jan Asselijn",
    RIJKSMUSEUM
  ),
  commons(
    "Avercamp,_Hendrick_-_Winterlandschap_met_schaatsers_-_SK-A-1718.jpg",
    "Paisagem de inverno com patinadores",
    "Hendrick Avercamp",
    RIJKSMUSEUM
  ),
  commons(
    "De_molen_bij_Wijk_bij_Duurstede_Rijksmuseum_SK-C-211.jpeg",
    "O moinho de Wijk bij Duurstede",
    "Jacob van Ruisdael",
    RIJKSMUSEUM
  ),
  commons(
    "De_Singelbrug_bij_de_Paleisstraat_in_Amsterdam_De_Singelbrug_bij_de_Paleisstraat_te_Amsterdam,_SK-A-3580.jpg",
    "A ponte Singel na Paleisstraat",
    "George Hendrik Breitner",
    RIJKSMUSEUM
  ),
  commons(
    "Stilleven_met_bloemen_en_vruchten_Rijksmuseum_SK-C-155.jpeg",
    "Natureza-morta com flores e frutas",
    "Jan van Huysum",
    RIJKSMUSEUM
  ),
];

const USDA = "Coleção de Aquarelas Pomológicas do USDA";

const POMOLOGICAL_WATERCOLORS: GalleryItem[] = [
  commons(
    "Pomological_Watercolor_POM00000001.jpg",
    "Pêssegos Connecticut",
    "Deborah Griscom Passmore",
    USDA
  ),
  commons(
    "Pomological_Watercolor_POM00000004.jpg",
    "Maçãs Sparks Late",
    "William Henry Prestele",
    USDA
  ),
  commons(
    "Pomological_Watercolor_POM00000006.jpg",
    "Maçãs Orange Winter",
    "William Henry Prestele",
    USDA
  ),
  commons(
    "Pomological_Watercolor_POM00000013.jpg",
    "Maçãs Yellow Transparent",
    "Royal Charles Steadman",
    USDA
  ),
  commons(
    "Pomological_Watercolor_POM00000014.jpg",
    "Marmelos Champion",
    "Royal Charles Steadman",
    USDA
  ),
  commons(
    "Pomological_Watercolor_POM00000016.jpg",
    "Marmelos Pineapple",
    "Royal Charles Steadman",
    USDA
  ),
  commons(
    "Pomological_Watercolor_POM00000020.jpg",
    "Maçãs Boardman",
    "Henry G. Van Deman",
    USDA
  ),
  commons(
    "Krieger_cherries-Marasca-Moscata-1933.jpg",
    "Cerejas Marasca Moscata",
    "Louis Charles Christopher Krieger",
    USDA
  ),
];

const NMAA = "Museu Nacional de Arte Asiática";

const ASIAN_ART: GalleryItem[] = [
  commons(
    "SotatsuScreen1.jpg",
    "Ondas em Matsushima (biombo direito)",
    "Tawaraya Sōtatsu",
    NMAA
  ),
  commons(
    "FS-F1906.231_001.jpg",
    "Ondas em Matsushima (biombo esquerdo)",
    "Tawaraya Sōtatsu",
    NMAA
  ),
  commons("Cranes_(left).png", "Grous", "Ogata Kōrin", NMAA),
  commons(
    "Whistler_-_Harmony_in_Blue_and_Gold_The_Peacock_Room,_FS-F1904.61_006.jpg",
    "Harmonia em azul e ouro: a Sala do Pavão",
    "James McNeill Whistler",
    NMAA
  ),
  commons(
    "James_McNeill_Whistler_-_Caprice_in_Purple_and_Gold-_The_Golden_Screen_-_Google_Art_Project.jpg",
    "Capricho em púrpura e ouro: o biombo dourado",
    "James McNeill Whistler",
    NMAA
  ),
  commons(
    "Peach_Festival_of_the_Queen_Mother_of_the_West,_Freer_Gallery_of_Art.jpg",
    "Festival dos pêssegos da Rainha-Mãe do Oeste",
    "Autor desconhecido",
    NMAA
  ),
  commons(
    "Emperor_Minghuang's_Journey_to_Sichuan,_Freer_Gallery_of_Art.jpg",
    "Viagem do imperador Minghuang a Sichuan",
    "Qiu Ying",
    NMAA
  ),
  commons(
    "Wu_Zhen._Fishermen._section.32,5x562,2cm._ca._1340._Freer..jpg",
    "Pescadores",
    "Wu Zhen",
    NMAA
  ),
];

const PASTEL: GalleryItem[] = [
  gradient(
    "ocean",
    "Oceano",
    "linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)"
  ),
  gradient(
    "sunset",
    "Pôr do sol",
    "linear-gradient(120deg, #ff9a9e 0%, #fecfef 60%, #fad0c4 100%)"
  ),
  gradient(
    "forest",
    "Floresta",
    "linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)"
  ),
  gradient(
    "lavender",
    "Lavanda",
    "linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)"
  ),
  gradient(
    "peach",
    "Pêssego",
    "linear-gradient(120deg, #ffecd2 0%, #fcb69f 100%)"
  ),
  gradient(
    "night",
    "Noite",
    "linear-gradient(120deg, #2c3e50 0%, #4ca1af 100%)"
  ),
  gradient(
    "sand",
    "Areia",
    "linear-gradient(120deg, #f6d365 0%, #fda085 100%)"
  ),
  gradient(
    "mint",
    "Menta",
    "linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%)"
  ),
  gradient(
    "aurora",
    "Aurora",
    "linear-gradient(120deg, #43e97b 0%, #38f9d7 100%)"
  ),
  gradient("rose", "Rosa", "linear-gradient(120deg, #fbc2eb 0%, #a6c1ee 100%)"),
  gradient(
    "slate",
    "Ardósia",
    "linear-gradient(120deg, #bdc3c7 0%, #2c3e50 100%)"
  ),
  gradient(
    "ember",
    "Brasa",
    "linear-gradient(120deg, #f12711 0%, #f5af19 100%)"
  ),
];

/** Seções da aba Galeria, na ordem em que aparecem. */
export const GALLERY: GallerySection[] = [
  { items: COLORS_AND_GRADIENTS, title: "Cor e gradiente" },
  { items: JAPANESE_PRINTS, title: "Gravuras japonesas · Museu MET" },
  { items: RIJKSMUSEUM_WORKS, title: "Rijksmuseum" },
  { items: POMOLOGICAL_WATERCOLORS, title: "Aquarelas pomológicas do USDA" },
  { items: ASIAN_ART, title: "Museu Nacional de Arte Asiática" },
  { items: HUDSON_RIVER_SCHOOL, title: "Museu MET · Hudson River School" },
  { items: PASTEL, title: "Pastel" },
];

/** Gradientes conhecidos, para resolver `gradient:<id>` gravado nas notas. */
export const GRADIENTS: GradientPreset[] = GALLERY.flatMap((section) =>
  section.items.filter(
    (item): item is GradientPreset => item.kind === "gradient"
  )
);

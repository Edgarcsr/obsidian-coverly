import { requestUrl } from "obsidian";

import type { CreditInfo } from "./note-data";

export interface UnsplashPhoto {
  id: string;
  thumb: string;
  regular: string;
  alt: string;
  photographer: CreditInfo;
  downloadLocation: string;
}

/** Forma parcial da resposta da busca do Unsplash, só com os campos usados. */
interface UnsplashResult {
  id?: string;
  alt_description?: string | null;
  links?: { download_location?: string; html?: string };
  urls?: { small?: string; regular?: string };
  user?: { name?: string; links?: { html?: string } };
}

const API = "https://api.unsplash.com";

/** Parâmetro de atribuição exigido pelas diretrizes da API do Unsplash. */
const UTM = "utm_source=coverly&utm_medium=referral";

const headers = (accessKey: string): Record<string, string> => ({
  "Accept-Version": "v1",
  Authorization: `Client-ID ${accessKey}`,
});

export const searchUnsplash = async (
  accessKey: string,
  query: string
): Promise<UnsplashPhoto[]> => {
  const params = new URLSearchParams({
    orientation: "landscape",
    per_page: "24",
    query,
  });

  const res = await requestUrl({
    headers: headers(accessKey),
    throw: false,
    url: `${API}/search/photos?${params.toString()}`,
  });

  if (res.status === 401) {
    throw new Error("Access Key do Unsplash inválida.");
  }
  if (res.status === 403 || res.status === 429) {
    throw new Error(
      "Limite de requisições do Unsplash atingido. O plano gratuito permite 50 por hora."
    );
  }
  if (res.status !== 200) {
    throw new Error(`Falha na busca do Unsplash (HTTP ${res.status}).`);
  }

  const results = (res.json?.results ?? []) as UnsplashResult[];
  return results.map((photo) => ({
    alt: photo.alt_description ?? "",
    downloadLocation: photo.links?.download_location ?? "",
    id: String(photo.id ?? ""),
    photographer: {
      name: photo.user?.name ?? "Unsplash",
      url: `${photo.user?.links?.html ?? "https://unsplash.com"}?${UTM}`,
    },
    regular: photo.urls?.regular ?? "",
    thumb: photo.urls?.small ?? "",
  }));
};

/** A API exige avisar o download quando a foto é usada. Falhas aqui não bloqueiam o uso. */
export const trackUnsplashDownload = async (
  accessKey: string,
  downloadLocation: string
): Promise<void> => {
  if (!downloadLocation) {
    return;
  }
  await requestUrl({
    headers: headers(accessKey),
    throw: false,
    url: downloadLocation,
  });
};

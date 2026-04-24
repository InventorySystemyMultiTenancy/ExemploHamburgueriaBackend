import axios from "axios";
import { AppError } from "../errors/AppError.js";

const STORE_LAT = parseFloat(process.env.STORE_LAT || "-23.5505");
const STORE_LON = parseFloat(process.env.STORE_LON || "-46.6333");
const TAXA_BASE = parseFloat(process.env.DELIVERY_BASE_FEE || "6.0");
const TAXA_POR_KM = parseFloat(process.env.DELIVERY_FEE_PER_KM || "2.5");

const formatBRL = (v) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function axiosWithRetry(config, maxRetries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await axios(config);
    } catch (err) {
      if (err.response) throw err;
      lastErr = err;
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastErr;
}

export class DeliveryService {
  async calculateFreight({ cep, numero, cidade, rua }) {
    const cleanCep = cep.replace(/\D/g, "");
    const query = rua?.trim()
      ? `${rua.trim()}, ${numero}, ${cidade}, Brasil`
      : `${cleanCep}, ${numero}, ${cidade}, Brasil`;

    let lat, lon;

    try {
      const nominatimRes = await axiosWithRetry({
        method: "get",
        url: "https://nominatim.openstreetmap.org/search",
        params: {
          q: query,
          format: "json",
          limit: 1,
          countrycodes: "br",
        },
        headers: {
          "User-Agent": `${process.env.STORE_NAME || "Hamburgueria"}/1.0`,
          "Accept-Language": "pt-BR",
        },
        timeout: 15000,
      });

      if (!nominatimRes.data?.length) {
        throw new AppError(
          "Endereco nao encontrado. Verifique o CEP, numero e cidade informados.",
          422,
        );
      }

      lat = parseFloat(nominatimRes.data[0].lat);
      lon = parseFloat(nominatimRes.data[0].lon);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        "Servico de geocodificacao indisponivel. Tente novamente.",
        503,
      );
    }

    // OSRM para distância real de rota
    let distanciaKm;

    try {
      const osrmRes = await axiosWithRetry({
        method: "get",
        url: `https://router.project-osrm.org/route/v1/driving/${STORE_LON},${STORE_LAT};${lon},${lat}`,
        params: { overview: "false" },
        timeout: 10000,
      });

      const routes = osrmRes.data?.routes;
      if (!routes?.length) throw new Error("Sem rota encontrada");

      distanciaKm = routes[0].distance / 1000;
    } catch {
      // Fallback: distância euclidiana × 1.3 (fator de tortuosidade)
      const R = 6371;
      const dLat = ((lat - STORE_LAT) * Math.PI) / 180;
      const dLon = ((lon - STORE_LON) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((STORE_LAT * Math.PI) / 180) *
          Math.cos((lat * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      distanciaKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3;
    }

    const valorFrete = TAXA_BASE + distanciaKm * TAXA_POR_KM;
    const tempoEstimado = Math.round(10 + distanciaKm * 3); // min

    return {
      distanciaKm: parseFloat(distanciaKm.toFixed(2)),
      valorFrete: parseFloat(valorFrete.toFixed(2)),
      valorFreteFormatado: formatBRL(valorFrete),
      tempoEstimado,
      lat,
      lon,
    };
  }
}

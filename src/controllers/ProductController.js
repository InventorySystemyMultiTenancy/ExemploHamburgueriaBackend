import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";
import { ProductService } from "../services/ProductService.js";
import {
  createProductSchema,
  updateProductSchema,
  createAddonSchema,
  createComboSchema,
  updateComboSchema,
} from "../validators/productSchemas.js";

const productService = new ProductService();

export class ProductController {
  // ── Produtos (público) ────────────────────────────────────────────────────

  async list(_req, res, next) {
    try {
      const products = await productService.listProducts();
      return res.status(200).json({ data: products });
    } catch (error) {
      return next(error);
    }
  }

  async listAdmin(_req, res, next) {
    try {
      const products = await productService.listProductsForAdmin();
      return res.status(200).json({ data: products });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const product = await productService.getProductById(req.params.productId);
      return res.status(200).json({ data: product });
    } catch (error) {
      return next(error);
    }
  }

  async listTopSelling(req, res, next) {
    try {
      const limit = req.query.limit;
      const products = await productService.listTopSelling(limit);
      return res.status(200).json({ data: products });
    } catch (error) {
      return next(error);
    }
  }

  // ── Produtos (admin) ──────────────────────────────────────────────────────

  async create(req, res, next) {
    try {
      const payload = createProductSchema.parse(req.body);
      const product = await productService.createProduct(payload);
      return res.status(201).json({ data: product });
    } catch (error) {
      return this.#handleError(error, next);
    }
  }

  async update(req, res, next) {
    try {
      const payload = updateProductSchema.parse(req.body);
      const product = await productService.updateProduct(
        req.params.productId,
        payload,
      );
      return res.status(200).json({ data: product });
    } catch (error) {
      return this.#handleError(error, next);
    }
  }

  async deactivate(req, res, next) {
    try {
      await productService.deactivateProduct(req.params.productId);
      return res.status(200).json({ message: "Produto desativado." });
    } catch (error) {
      return next(error);
    }
  }

  async restore(req, res, next) {
    try {
      await productService.restoreProduct(req.params.productId);
      return res.status(200).json({ message: "Produto restaurado." });
    } catch (error) {
      return next(error);
    }
  }

  // ── Adicionais ────────────────────────────────────────────────────────────

  async listAddons(_req, res, next) {
    try {
      const addons = await productService.listAddons();
      return res.status(200).json({ data: addons });
    } catch (error) {
      return next(error);
    }
  }

  async createAddon(req, res, next) {
    try {
      const payload = createAddonSchema.parse(req.body);
      const addon = await productService.createAddon(payload);
      return res.status(201).json({ data: addon });
    } catch (error) {
      return this.#handleError(error, next);
    }
  }

  async updateAddon(req, res, next) {
    try {
      const addon = await productService.updateAddon(
        req.params.addonId,
        req.body,
      );
      return res.status(200).json({ data: addon });
    } catch (error) {
      return next(error);
    }
  }

  async deactivateAddon(req, res, next) {
    try {
      await productService.deactivateAddon(req.params.addonId);
      return res.status(200).json({ message: "Adicional desativado." });
    } catch (error) {
      return next(error);
    }
  }

  // ── Combos ────────────────────────────────────────────────────────────────

  async listCombos(_req, res, next) {
    try {
      const combos = await productService.listCombos();
      return res.status(200).json({ data: combos });
    } catch (error) {
      return next(error);
    }
  }

  async listCombosAdmin(_req, res, next) {
    try {
      const combos = await productService.listCombosForAdmin();
      return res.status(200).json({ data: combos });
    } catch (error) {
      return next(error);
    }
  }

  async createCombo(req, res, next) {
    try {
      const payload = createComboSchema.parse(req.body);
      const combo = await productService.createCombo(payload);
      return res.status(201).json({ data: combo });
    } catch (error) {
      return this.#handleError(error, next);
    }
  }

  async updateCombo(req, res, next) {
    try {
      const payload = updateComboSchema.parse(req.body);
      const combo = await productService.updateCombo(
        req.params.comboId,
        payload,
      );
      return res.status(200).json({ data: combo });
    } catch (error) {
      return this.#handleError(error, next);
    }
  }

  async deactivateCombo(req, res, next) {
    try {
      await productService.deactivateCombo(req.params.comboId);
      return res.status(200).json({ message: "Combo desativado." });
    } catch (error) {
      return next(error);
    }
  }

  #handleError(error, next) {
    if (error instanceof ZodError) {
      return next(new AppError("Payload invalido.", 422, error.flatten()));
    }
    return next(error);
  }
}

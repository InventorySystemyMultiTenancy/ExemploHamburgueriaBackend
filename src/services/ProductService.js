import { AppError } from "../errors/AppError.js";
import { ProductRepository } from "../repositories/ProductRepository.js";

const productRepository = new ProductRepository();

export class ProductService {
  // ── Produtos ─────────────────────────────────────────────────────────────

  async listProducts() {
    return productRepository.findAll();
  }

  async listProductsForAdmin() {
    return productRepository.findAllForAdmin();
  }

  async getProductById(productId) {
    const product = await productRepository.findById(productId);
    if (!product) throw new AppError("Produto nao encontrado.", 404);
    return product;
  }

  async createProduct({
    name,
    description,
    imageUrl,
    category,
    basePrice,
    isBurger,
    addonIds,
    ingredients,
  }) {
    const product = await productRepository.create({
      name,
      description,
      imageUrl,
      category,
      basePrice,
      isBurger,
    });

    if (addonIds?.length) {
      await productRepository.syncAddons(product.id, addonIds);
    }

    return productRepository.findById(product.id);
  }

  async updateProduct(productId, payload) {
    const existing = await productRepository.findById(productId);
    if (!existing) throw new AppError("Produto nao encontrado.", 404);

    const { addonIds, ...rest } = payload;

    const product = await productRepository.update(productId, rest);

    if (addonIds !== undefined) {
      await productRepository.syncAddons(productId, addonIds);
    }

    return productRepository.findById(productId);
  }

  async deactivateProduct(productId) {
    const existing = await productRepository.findById(productId);
    if (!existing) throw new AppError("Produto nao encontrado.", 404);
    return productRepository.setActive(productId, false);
  }

  async restoreProduct(productId) {
    const existing = await productRepository.findById(productId);
    if (!existing) throw new AppError("Produto nao encontrado.", 404);
    return productRepository.setActive(productId, true);
  }

  async listTopSelling(limit = 6) {
    const capped = Math.min(Math.max(Number(limit) || 6, 1), 50);
    return productRepository.findTopSelling(capped);
  }

  // ── Adicionais ────────────────────────────────────────────────────────────

  async listAddons() {
    return productRepository.findAllAddons();
  }

  async createAddon({ name, description, price, category }) {
    return productRepository.createAddon({
      name,
      description,
      price,
      category,
    });
  }

  async updateAddon(addonId, data) {
    const existing = await productRepository.findAddonById(addonId);
    if (!existing) throw new AppError("Adicional nao encontrado.", 404);
    return productRepository.updateAddon(addonId, data);
  }

  async deactivateAddon(addonId) {
    const existing = await productRepository.findAddonById(addonId);
    if (!existing) throw new AppError("Adicional nao encontrado.", 404);
    return productRepository.setAddonActive(addonId, false);
  }

  // ── Combos ────────────────────────────────────────────────────────────────

  async listCombos() {
    return productRepository.findAllCombos();
  }

  async listCombosForAdmin() {
    return productRepository.findAllCombosForAdmin();
  }

  async createCombo({ name, description, imageUrl, promotionalPrice, parts }) {
    if (!parts?.length)
      throw new AppError("Combo deve ter ao menos 1 produto.", 422);
    return productRepository.createCombo({
      name,
      description,
      imageUrl,
      promotionalPrice,
      parts,
    });
  }

  async updateCombo(comboId, payload) {
    const existing = await productRepository.findComboById(comboId);
    if (!existing) throw new AppError("Combo nao encontrado.", 404);
    return productRepository.updateCombo(comboId, payload);
  }

  async deactivateCombo(comboId) {
    const existing = await productRepository.findComboById(comboId);
    if (!existing) throw new AppError("Combo nao encontrado.", 404);
    return productRepository.setComboActive(comboId, false);
  }
}

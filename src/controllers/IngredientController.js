import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";
import { IngredientRepository } from "../repositories/IngredientRepository.js";
import {
  createIngredientSchema,
  updateIngredientSchema,
} from "../validators/productSchemas.js";

const ingredientRepository = new IngredientRepository();

export class IngredientController {
  async list(_req, res, next) {
    try {
      const ingredients = await ingredientRepository.findAll();
      return res.status(200).json({ data: ingredients });
    } catch (error) {
      return next(error);
    }
  }

  async listLowStock(_req, res, next) {
    try {
      const ingredients = await ingredientRepository.findLowStock();
      return res.status(200).json({ data: ingredients });
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const payload = createIngredientSchema.parse(req.body);
      const ingredient = await ingredientRepository.create(payload);
      return res.status(201).json({ data: ingredient });
    } catch (error) {
      if (error instanceof ZodError) {
        return next(new AppError("Payload invalido.", 422, error.flatten()));
      }
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const payload = updateIngredientSchema.parse(req.body);
      const ingredient = await ingredientRepository.update(
        req.params.ingredientId,
        payload,
      );
      return res.status(200).json({ data: ingredient });
    } catch (error) {
      if (error instanceof ZodError) {
        return next(new AppError("Payload invalido.", 422, error.flatten()));
      }
      return next(error);
    }
  }

  async adjustStock(req, res, next) {
    try {
      const { delta } = req.body;
      if (typeof delta !== "number") {
        throw new AppError(
          "delta deve ser um numero (positivo para entrada, negativo para saida).",
          422,
        );
      }
      const ingredient = await ingredientRepository.adjustStock(
        req.params.ingredientId,
        delta,
      );
      return res.status(200).json({ data: ingredient });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await ingredientRepository.delete(req.params.ingredientId);
      return res.status(200).json({ message: "Ingrediente removido." });
    } catch (error) {
      return next(error);
    }
  }
}

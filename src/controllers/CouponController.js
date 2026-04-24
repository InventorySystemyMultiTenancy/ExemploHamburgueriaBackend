import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";
import { CouponRepository } from "../repositories/CouponRepository.js";
import {
  createCouponSchema,
  updateCouponSchema,
} from "../validators/couponSchemas.js";

const couponRepository = new CouponRepository();

export class CouponController {
  async list(_req, res, next) {
    try {
      const coupons = await couponRepository.findAll();
      return res.status(200).json({ data: coupons });
    } catch (error) {
      return next(error);
    }
  }

  async validate(req, res, next) {
    try {
      const { code } = req.params;
      const coupon = await couponRepository.findByCode(code);

      if (!coupon || !coupon.isActive) {
        return res
          .status(404)
          .json({ error: { message: "Cupom nao encontrado ou inativo." } });
      }

      if (coupon.expiresAt && new Date() > coupon.expiresAt) {
        return res.status(422).json({ error: { message: "Cupom expirado." } });
      }

      if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
        return res.status(422).json({ error: { message: "Cupom esgotado." } });
      }

      return res.status(200).json({
        data: {
          code: coupon.code,
          type: coupon.type,
          value: Number(coupon.value),
          minOrderValue: coupon.minOrderValue
            ? Number(coupon.minOrderValue)
            : null,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const payload = createCouponSchema.parse(req.body);
      const coupon = await couponRepository.create(payload);
      return res.status(201).json({ data: coupon });
    } catch (error) {
      if (error instanceof ZodError) {
        return next(new AppError("Payload invalido.", 422, error.flatten()));
      }
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const payload = updateCouponSchema.parse(req.body);
      const coupon = await couponRepository.update(
        req.params.couponId,
        payload,
      );
      return res.status(200).json({ data: coupon });
    } catch (error) {
      if (error instanceof ZodError) {
        return next(new AppError("Payload invalido.", 422, error.flatten()));
      }
      return next(error);
    }
  }

  async deactivate(req, res, next) {
    try {
      const coupon = await couponRepository.setActive(
        req.params.couponId,
        false,
      );
      return res
        .status(200)
        .json({ message: "Cupom desativado.", data: coupon });
    } catch (error) {
      return next(error);
    }
  }
}

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppError } from "../errors/AppError.js";
import { UserRepository } from "../repositories/UserRepository.js";

const STAFF_ROLES = new Set(["ADMIN", "FUNCIONARIO", "COZINHA", "MOTOBOY"]);

export class AuthService {
  constructor(userRepository = new UserRepository()) {
    this.userRepository = userRepository;
  }

  async register(
    { name, email, phone, cpf, address, password, role },
    authUser = null,
  ) {
    if (email) {
      const existing = await this.userRepository.findByEmail(email);
      if (existing) throw new AppError("Email ja cadastrado.", 409);
    }

    if (phone) {
      const existing = await this.userRepository.findByPhone(phone);
      if (existing) throw new AppError("Telefone ja cadastrado.", 409);
    }

    if (cpf) {
      const existing = await this.userRepository.findByCpf(cpf);
      if (existing) throw new AppError("CPF ja cadastrado.", 409);
    }

    const requestedRole = role || "CLIENTE";

    if (STAFF_ROLES.has(requestedRole)) {
      if (!authUser)
        throw new AppError("Apenas admin pode criar contas de equipe.", 403);
      if (authUser.role !== "ADMIN")
        throw new AppError("Apenas admin pode criar contas de equipe.", 403);
    }

    if (requestedRole === "ADMIN" && authUser?.role !== "ADMIN") {
      throw new AppError("Apenas admin pode criar outro admin.", 403);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.userRepository.create({
      name,
      email: email || null,
      phone: phone || null,
      cpf: cpf || null,
      address: address || null,
      passwordHash,
      role: requestedRole,
    });

    if (requestedRole === "CLIENTE") {
      const token = this.#generateToken(user);
      return {
        accessToken: token,
        user: this.#safeUser(user),
      };
    }

    return { user: this.#safeUser(user) };
  }

  async login({ identifier, password }) {
    const user = await this.userRepository.findByEmailOrPhone(identifier);
    if (!user) throw new AppError("Credenciais invalidas.", 401);

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) throw new AppError("Credenciais invalidas.", 401);

    const token = this.#generateToken(user);

    return {
      accessToken: token,
      user: this.#safeUser(user),
    };
  }

  #generateToken(user) {
    return jwt.sign(
      { role: user.role, email: user.email || null },
      process.env.JWT_SECRET,
      { subject: user.id, expiresIn: process.env.JWT_EXPIRES_IN || "8h" },
    );
  }

  #safeUser(user) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
    };
  }
}

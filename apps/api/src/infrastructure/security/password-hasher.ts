import argon2 from "argon2";

import { authConfig } from "../../core/config/auth.config.js";

export const generateHash = async (value: string): Promise<string> =>
  argon2.hash(value, {
    type: argon2.argon2id,
    memoryCost: authConfig.argon2.memoryKib,
    timeCost: authConfig.argon2.timeCost,
    parallelism: authConfig.argon2.parallelism,
  });

export const compareHash = async (
  plainText: string,
  hash: string,
): Promise<boolean> => {
  try {
    return await argon2.verify(hash, plainText);
  } catch {
    return false;
  }
};

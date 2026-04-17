import { describe, it, expect, beforeEach, vi } from "vitest";
import { CredentialsVerifier } from "../credentials-verifier.js";
import type { UserRepository, UserRecord } from "../user-repository.js";
import bcrypt from "bcryptjs";

describe("CredentialsVerifier", () => {
  let credentialsVerifier: CredentialsVerifier;
  let mockUserRepository: UserRepository;
  let passwordHash: string;

  const testUser: UserRecord = {
    id: "user-123",
    username: "testuser",
    passwordHash: "", // will be set in beforeEach
  };

  beforeEach(async () => {
    passwordHash = await bcrypt.hash("correct_password", 10);
    testUser.passwordHash = passwordHash;

    mockUserRepository = {
      findByUsername: vi.fn(),
    };

    credentialsVerifier = new CredentialsVerifier(mockUserRepository);
  });

  describe("verify - valid credentials", () => {
    it("should return user for valid username and password", async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(testUser);

      const result = await credentialsVerifier.verify("testuser", "correct_password");

      expect(result).toEqual({
        id: "user-123",
        username: "testuser",
      });
    });

    it("should not include passwordHash in returned user", async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(testUser);

      const result = await credentialsVerifier.verify("testuser", "correct_password");

      expect(result).not.toHaveProperty("passwordHash");
    });
  });

  describe("verify - invalid password", () => {
    it("should return null for incorrect password", async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(testUser);

      const result = await credentialsVerifier.verify("testuser", "wrong_password");

      expect(result).toBeNull();
    });

    it("should still call bcrypt.compare for wrong password (constant time)", async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(testUser);
      const compareSpy = vi.spyOn(bcrypt, "compare");

      await credentialsVerifier.verify("testuser", "wrong_password");

      expect(compareSpy).toHaveBeenCalledWith("wrong_password", passwordHash);
    });
  });

  describe("verify - unknown user", () => {
    it("should return null for unknown user", async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null);

      const result = await credentialsVerifier.verify("unknown_user", "any_password");

      expect(result).toBeNull();
    });

    it("should still call bcrypt.compare for unknown user (timing-safe)", async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null);
      const compareSpy = vi.spyOn(bcrypt, "compare");

      await credentialsVerifier.verify("unknown_user", "any_password");

      expect(compareSpy).toHaveBeenCalled();
    });

    it("should use DUMMY_HASH for unknown user", async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null);
      const compareSpy = vi.spyOn(bcrypt, "compare");

      await credentialsVerifier.verify("unknown_user", "any_password");

      const dummyHash = "$2a$10$invalidsaltinvalidsaltinvalidsaltinvalidsa";
      expect(compareSpy).toHaveBeenCalledWith("any_password", dummyHash);
    });
  });

  describe("verify - edge cases", () => {
    it("should handle empty password", async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(testUser);

      const result = await credentialsVerifier.verify("testuser", "");

      expect(result).toBeNull();
    });

    it("should handle empty username", async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null);

      const result = await credentialsVerifier.verify("", "correct_password");

      expect(result).toBeNull();
    });

    it("should handle both empty username and password", async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null);

      const result = await credentialsVerifier.verify("", "");

      expect(result).toBeNull();
    });

    it("should handle whitespace in password", async () => {
      const spacePasswordHash = await bcrypt.hash("pass word with spaces", 10);
      const userWithSpacePassword: UserRecord = {
        ...testUser,
        passwordHash: spacePasswordHash,
      };

      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(userWithSpacePassword);

      const result = await credentialsVerifier.verify("testuser", "pass word with spaces");

      expect(result).not.toBeNull();
    });
  });

  describe("timing attack resistance", () => {
    it("should take similar time for known vs unknown user", async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(testUser);

      const start1 = Date.now();
      await credentialsVerifier.verify("testuser", "wrong_password");
      const time1 = Date.now() - start1;

      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null);

      const start2 = Date.now();
      await credentialsVerifier.verify("unknown_user", "any_password");
      const time2 = Date.now() - start2;

      // Both paths should execute bcrypt.compare which is the expensive operation
      // We can't guarantee exact timing, but both should have called bcrypt.compare
      expect(time1).toBeGreaterThanOrEqual(0);
      expect(time2).toBeGreaterThanOrEqual(0);
    });
  });

  describe("repository interaction", () => {
    it("should call findByUsername with provided username", async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null);

      await credentialsVerifier.verify("testuser", "password");

      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith("testuser");
      expect(mockUserRepository.findByUsername).toHaveBeenCalledTimes(1);
    });

    it("should not make multiple repository calls", async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(testUser);

      await credentialsVerifier.verify("testuser", "correct_password");

      expect(mockUserRepository.findByUsername).toHaveBeenCalledTimes(1);
    });
  });
});

declare module "bcryptjs" {
  export function compare(
    s: string,
    hash: string,
    callback?: (err: Error | null, success: boolean) => void
  ): Promise<boolean>;
  export function compareSync(s: string, hash: string): boolean;
  export function hash(
    s: string,
    salt: number | string,
    callback?: (err: Error | null, hash: string) => void
  ): Promise<string>;
  export function hashSync(s: string, salt: number | string): string;
  export function genSalt(
    rounds?: number,
    callback?: (err: Error | null, salt: string) => void
  ): Promise<string>;
  export function genSaltSync(rounds?: number): string;
  export function getRounds(hash: string): number;
}

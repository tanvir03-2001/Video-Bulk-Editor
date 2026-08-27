declare module '@xenova/transformers' {
  export const env: {
    cacheDir: string;
    allowLocalModels: boolean;
    allowRemoteModels?: boolean;
    [key: string]: unknown;
  };

  export function pipeline(
    task: string,
    model: string,
    options?: Record<string, unknown>,
  ): Promise<
    (
      input: string,
      labels?: string[],
      options?: Record<string, unknown>,
    ) => Promise<Array<{ label: string; score: number }>>
  >;
}

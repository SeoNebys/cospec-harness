export class AppProblem extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail: string,
    public errors?: Record<string, string[]>,
    public extra?: object
  ) {
    super(detail);
  }
}

export class ResumeParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResumeParseError'
  }
}

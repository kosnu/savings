import { PaymentRepository } from "../domain/repository.ts"
import { DomainError } from "../shared/errors.ts"
import { Result } from "../shared/result.ts"

export type GetMonthlyTotalInput = {
  readonly userId: number
  readonly month: string
}

export async function getMonthlyTotalUseCase(
  input: GetMonthlyTotalInput,
  paymentRepository: PaymentRepository,
): Promise<Result<number, DomainError>> {
  const result = await paymentRepository.monthlyTotal(input)
  return result
}

import { Payment } from "../domain/entities/payment.ts"
import { PaymentRepository, PaymentSearchParams } from "../domain/repository.ts"
import { DomainError } from "../shared/errors.ts"
import { Result } from "../shared/result.ts"

export async function searchPaymentsUseCase(
  criteria: PaymentSearchParams,
  paymentRepository: PaymentRepository,
): Promise<Result<ReadonlyArray<Payment>, DomainError>> {
  const result = await paymentRepository.search(criteria)
  return result
}

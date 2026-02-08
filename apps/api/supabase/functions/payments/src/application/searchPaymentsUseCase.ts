import { PaymentRepository, PaymentSearchParams } from "../domain/repository.ts"
import { DomainError } from "../shared/errors.ts"
import { Result } from "../shared/result.ts"
import { convertPaymentToDto, PaymentDto } from "./paymentDto.ts"

export async function searchPaymentsUseCase(
  criteria: PaymentSearchParams,
  paymentRepository: PaymentRepository,
): Promise<Result<ReadonlyArray<PaymentDto>, DomainError>> {
  const result = await paymentRepository.search(criteria)
  return result.isOk
    ? { isOk: true, value: result.value.map(convertPaymentToDto) }
    : result
}

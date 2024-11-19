import { ButtonBase, type ButtonBaseProps } from "../ButtonBase"
import styles from "./OutlinedButton.module.css"

export interface OutlinedButtonProps extends ButtonBaseProps {}

export function OutlinedButton({ ...props }: OutlinedButtonProps) {
  return <ButtonBase {...props} className={styles.buttonPrimary} />
}

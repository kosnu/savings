import { ButtonBase, type ButtonBaseProps } from "../ButtonBase"
import styles from "./ContainedButton.module.css"

export interface ContainedButtonProps extends ButtonBaseProps {}

export function ContainedButton({ ...props }: ContainedButtonProps) {
  return <ButtonBase {...props} className={styles.buttonPrimary} />
}

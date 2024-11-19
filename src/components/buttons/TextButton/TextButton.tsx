import { ButtonBase, type ButtonBaseProps } from "../ButtonBase"
import styles from "./TextButton.module.css"

export interface TextButtonProps extends ButtonBaseProps {}

export function TextButton({ ...props }: TextButtonProps) {
  return <ButtonBase {...props} className={styles.buttonPrimary} />
}

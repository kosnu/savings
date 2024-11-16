import { type ComponentProps, useId } from "react"
import styles from "./Textfield.module.css"

type InputProps = Omit<ComponentProps<"input">, "name">

interface TextfieldProps extends InputProps {
  label: React.ReactNode
  name: string
}

export function Textfield({ label, name, ...props }: TextfieldProps) {
  const id = useId()
  return (
    <div className={styles.textfieldRoot}>
      <fieldset className={styles.textfieldFieldset}>
        <legend>
          <label htmlFor={name}>{label}</label>
        </legend>
        <input
          {...props}
          id={`${name}-${id}`}
          name={name}
          className={styles.textfieldInput}
        />
      </fieldset>
    </div>
  )
}

import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDownIcon } from "@radix-ui/react-icons"
import { Reset } from "@radix-ui/themes"
import type * as React from "react"
import styles from "./Accordion.module.css"

function Accordion({
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={styles.accordionRoot}
      {...props}
    />
  )
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={`${styles.accordionItem} ${className}`}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <Reset>
      <AccordionPrimitive.Header className={styles.accordionHeader}>
        <Reset>
          <AccordionPrimitive.Trigger
            data-slot="accordion-trigger"
            className={`${styles.accordionTrigger} ${className}`}
            {...props}
          >
            {children}
            <ChevronDownIcon className={styles.accordionChevron} />
          </AccordionPrimitive.Trigger>
        </Reset>
      </AccordionPrimitive.Header>
    </Reset>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className={`${styles.accordionContent} ${className}`}
      {...props}
    >
      <div className={styles.accordionContentText}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }

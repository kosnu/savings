import { ChevronRightIcon } from "@radix-ui/react-icons"
import { Button, ChevronDownIcon, Flex, Reset, Text } from "@radix-ui/themes"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import styles from "./SidebarTreeButton.module.css"
import { useToggle } from "./useToggle"

interface TreeObject {
  id: string
  icon?: ReactNode
  label: string
  href?: string
  children?: TreeObject[]
}

interface SidebarTreeButtonProps {
  treeObject: TreeObject
}

export function SidebarTreeButton({ treeObject }: SidebarTreeButtonProps) {
  const { toggle, switchToggle } = useToggle()
  const hasChildren = !!treeObject.children?.length

  if (!hasChildren) {
    const TreeLinkButton = withLink(TreeButton, treeObject.href ?? "#")

    return (
      <TreeLinkButton ariaLabel={treeObject.label}>
        <TreeLabel startIcon={treeObject.icon}>{treeObject.label}</TreeLabel>
      </TreeLinkButton>
    )
  }

  return (
    <Flex direction="column" justify="start" gap="3" flexGrow="1">
      <TreeButton ariaLabel={treeObject.label} onClick={switchToggle}>
        <TreeLabel
          startIcon={treeObject.icon}
          endIcon={toggle ? <ChevronDownIcon /> : <ChevronRightIcon />}
        >
          {treeObject.label}
        </TreeLabel>
      </TreeButton>
      {toggle && (
        <Flex
          className={styles.treeChildrenWrapper}
          direction="column"
          justify="start"
          gap="3"
          pl="4"
        >
          {treeObject.children?.map((child) => (
            <SidebarTreeButton key={child.id} treeObject={child} />
          ))}
        </Flex>
      )}
    </Flex>
  )
}

interface TreeLabelProps {
  startIcon?: ReactNode
  endIcon?: ReactNode
  children: ReactNode
}

function TreeLabel({ startIcon, endIcon, children }: TreeLabelProps) {
  return (
    <Flex direction="row" justify="between" align="center" gap="3" flexGrow="1">
      {startIcon}
      <Text align="left" style={{ flex: "auto" }}>
        {children}
      </Text>
      {endIcon}
    </Flex>
  )
}

interface TreeButtonProps {
  ariaLabel: string
  children: ReactNode
  onClick?: () => void
}

function TreeButton({ ariaLabel, children, onClick }: TreeButtonProps) {
  return (
    <Button
      aria-label={ariaLabel}
      className={styles.treeButton}
      variant="ghost"
      size="3"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function withLink(Component: React.FC<TreeButtonProps>, href: string) {
  return function WrappedComponent({ children, ...props }: TreeButtonProps) {
    return (
      <Reset>
        <Link to={href}>
          <Component {...props}>{children}</Component>
        </Link>
      </Reset>
    )
  }
}

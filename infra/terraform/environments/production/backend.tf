terraform {
  backend "gcs" {
    bucket = "savings-tfstate"
    prefix = "production"
  }
}


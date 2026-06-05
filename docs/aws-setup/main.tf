# LocalDev Private Cloud Infrastructure
# This Terraform template sets up a private EC2 instance to host the LocalDev Sidecar
# and enables access to AWS Bedrock for high-performance, private AI inference.

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  default = "us-east-1"
}

variable "vpc_id" {
  description = "The ID of the VPC to deploy into"
}

variable "subnet_id" {
  description = "The ID of the subnet to deploy into"
}

# IAM Role for Bedrock Access
resource "aws_iam_role" "localdev_sidecar_role" {
  name = "LocalDevSidecarRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "bedrock_access" {
  role       = aws_iam_role.localdev_sidecar_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonBedrockFullAccess"
}

# EC2 Security Group
resource "aws_security_group" "localdev_sidecar_sg" {
  name        = "localdev-sidecar-sg"
  description = "Allow SSH for LocalDev Sidecar"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Recommendation: Restrict to your IP
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# EC2 Instance
resource "aws_instance" "localdev_sidecar" {
  ami           = "ami-0c101f26f147fa7fd" # Amazon Linux 2023 in us-east-1
  instance_type = "t3.medium"
  subnet_id     = var.subnet_id
  vpc_security_group_ids = [aws_security_group.localdev_sidecar_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.localdev_sidecar_profile.name

  tags = {
    Name = "LocalDev-Sidecar-Host"
  }

  user_data = <<-EOF
              #!/bin/bash
              dnf install -y python3 python3-pip git
              # Additional setup for the sidecar
              EOF
}

resource "aws_iam_instance_profile" "localdev_sidecar_profile" {
  name = "LocalDevSidecarProfile"
  role = aws_iam_role.localdev_sidecar_role.name
}

output "sidecar_host_public_ip" {
  value = aws_instance.localdev_sidecar.public_ip
}

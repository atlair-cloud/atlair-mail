export const sesIamPolicy = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AtlairMailSes",
      "Effect": "Allow",
      "Action": [
        "ses:GetAccount",
        "ses:CreateEmailIdentity",
        "ses:GetEmailIdentity",
        "ses:PutEmailIdentityMailFromAttributes",
        "ses:SendEmail"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AtlairMailEventConfigurationSet",
      "Effect": "Allow",
      "Action": [
        "ses:CreateConfigurationSet",
        "ses:CreateConfigurationSetEventDestination",
        "ses:UpdateConfigurationSetEventDestination"
      ],
      "Resource": "arn:aws:ses:*:*:configuration-set/atlair-mail"
    },
    {
      "Sid": "AtlairMailEventTopic",
      "Effect": "Allow",
      "Action": [
        "sns:CreateTopic",
        "sns:SetTopicAttributes",
        "sns:Subscribe",
        "sns:ConfirmSubscription",
        "sns:ListSubscriptionsByTopic",
        "sns:Unsubscribe"
      ],
      "Resource": "arn:aws:sns:*:*:atlair-mail-events"
    },
    {
      "Sid": "AtlairMailEventQueues",
      "Effect": "Allow",
      "Action": [
        "sqs:GetQueueUrl",
        "sqs:CreateQueue",
        "sqs:GetQueueAttributes",
        "sqs:SetQueueAttributes",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:SendMessage",
        "sqs:StartMessageMoveTask"
      ],
      "Resource": "arn:aws:sqs:*:*:atlair-mail-events-*"
    }
  ]
}`

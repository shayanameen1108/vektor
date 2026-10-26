# A tender analysis spends one Credit

An analysis spends its Credit when the Tender is accepted, before the file is stored or scored, and the Credit comes back if that work fails. Charging only after a successful score was rejected: a failure would still have done the work, and two requests could both pass a balance check that was not part of the write.

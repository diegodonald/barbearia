const errorMessages = {
  noAvailableSlots: "Não há horários disponíveis para a data selecionada.",
  serviceNotAvailable: "O agendamento não está disponível para a data selecionada.",
  barberNotAvailable: "O agendamento não está disponível para a data selecionada para o barbeiro escolhido.",
  insufficientSlots: "O horário selecionado não permite completar o serviço antes do fechamento.",
  nonConsecutiveSlots: "Os horários não são consecutivos (pode haver um intervalo entre eles).",
  slotNotAvailable: "O horário selecionado não está disponível.",
  serviceCrossesBreak: "O serviço não pode ser agendado porque cruza o horário de intervalo.",
  serviceExceedsClosing: "O horário selecionado não permite completar o serviço antes do fechamento.",
  slotAlreadyBooked: "Um ou mais horários necessários já estão ocupados para este barbeiro.",
  noBarberAvailable: "Não há barbeiros disponíveis para todos os horários necessários. Selecione outro horário.",
};

export default errorMessages;